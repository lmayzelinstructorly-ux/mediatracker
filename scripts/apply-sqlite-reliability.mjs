import fs from 'node:fs'

const mediaStorePath = 'server/media-store.js'
let mediaStore = fs.readFileSync(mediaStorePath, 'utf8')

const dbImport = "import { db } from './db.js'\n"
const lookupImport = "import { findExistingMediaInDatabase } from './media-lookup.js'\n"
if (!mediaStore.includes(lookupImport)) {
  mediaStore = mediaStore.replace(dbImport, dbImport + lookupImport)
}

const oldLookup = `function findExistingMedia(payload) {
  const titleKey = normalizeMediaTitle(payload.title)
  if (!titleKey) return null

  const type = mediaTypeFamily(payload.type)
  const rows = db.prepare('SELECT * FROM media').all()
  const match = rows.find((row) => {
    if (mediaTypeFamily(row.type) !== type) return false
    if (payload.tmdb_id != null && row.tmdb_id != null) {
      return Number(row.tmdb_id) === Number(payload.tmdb_id)
    }

    const yearsCompatible = !payload.release_year || !row.release_year || String(payload.release_year) === String(row.release_year)
    return normalizeMediaTitle(row.title) === titleKey && yearsCompatible
  })
  return match ? rowToMedia(match) : null
}`

const newLookup = `function findExistingMedia(payload) {
  return findExistingMediaInDatabase(db, payload, rowToMedia)
}`

if (!mediaStore.includes(oldLookup)) {
  throw new Error('Could not find the existing duplicate lookup implementation')
}
mediaStore = mediaStore.replace(oldLookup, newLookup)
fs.writeFileSync(mediaStorePath, mediaStore)

fs.writeFileSync('tests/migrations.test.js', `import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { runSchemaMigrations, schemaMigrations } from '../server/migrations/index.js'

function legacySchema(db) {
  db.exec(\`
    CREATE TABLE media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      cover_art TEXT,
      genres TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      description TEXT,
      runtime INTEGER DEFAULT 0,
      release_year TEXT,
      tmdb_rating REAL,
      status TEXT NOT NULL DEFAULT 'Want to Watch',
      priority INTEGER DEFAULT 0,
      personal_rating INTEGER,
      reflection TEXT,
      season INTEGER DEFAULT 1,
      episode INTEGER DEFAULT 0,
      completed_at TEXT,
      reminder_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  \`)
}

describe('SQLite schema migrations', () => {
  it('adopts an existing database without changing saved rows', () => {
    const db = new Database(':memory:')
    legacySchema(db)
    db.prepare('INSERT INTO media (title, type, status) VALUES (?, ?, ?)').run('Arrival', 'movie', 'Watched')
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('theme', 'dark')

    expect(runSchemaMigrations(db, { appliedAt: () => '2026-07-10T15:00:00.000Z' })).toEqual([1, 2])
    expect(db.prepare('SELECT title, status FROM media').get()).toEqual({ title: 'Arrival', status: 'Watched' })
    expect(db.prepare('SELECT value FROM settings WHERE key = ?').get('theme')).toEqual({ value: 'dark' })
    expect(db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all()).toEqual([
      { version: 1, name: 'initial-schema' },
      { version: 2, name: 'media-indexes' },
    ])

    const indexNames = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_media_%' ORDER BY name").all().map((row) => row.name)
    expect(indexNames).toEqual([
      'idx_media_status_priority_updated',
      'idx_media_title_type_year',
      'idx_media_tmdb_type',
      'idx_media_type',
      'idx_media_updated_at',
    ])
    db.close()
  })

  it('runs each migration only once', () => {
    const db = new Database(':memory:')
    expect(runSchemaMigrations(db)).toEqual([1, 2])
    expect(runSchemaMigrations(db)).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count).toBe(schemaMigrations.length)
    db.close()
  })

  it('rolls back a failed migration and does not record it', () => {
    const db = new Database(':memory:')
    const failingMigration = {
      version: 99,
      name: 'failing-test',
      up(database) {
        database.exec('CREATE TABLE should_rollback (id INTEGER)')
        throw new Error('stop migration')
      },
    }

    expect(() => runSchemaMigrations(db, { migrations: [failingMigration] })).toThrow('stop migration')
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'").get()).toBeUndefined()
    expect(db.prepare('SELECT * FROM schema_migrations WHERE version = 99').get()).toBeUndefined()
    db.close()
  })
})
`)

fs.writeFileSync('tests/media-lookup.test.js', `import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { findExistingMediaInDatabase } from '../server/media-lookup.js'
import { runSchemaMigrations } from '../server/migrations/index.js'

function createDb() {
  const db = new Database(':memory:')
  runSchemaMigrations(db)
  return db
}

function insertMedia(db, { tmdb_id = null, title, type, release_year = '', updated_at = '2026-07-10 12:00:00' }) {
  return db.prepare(\`
    INSERT INTO media (tmdb_id, title, type, release_year, updated_at)
    VALUES (?, ?, ?, ?, ?)
  \`).run(tmdb_id, title, type, release_year, updated_at)
}

describe('findExistingMediaInDatabase', () => {
  it('matches anime and shows in the same identity family by TMDB id', () => {
    const db = createDb()
    insertMedia(db, { tmdb_id: 777, title: 'Example Series', type: 'show', release_year: '2024' })

    const match = findExistingMediaInDatabase(db, {
      tmdb_id: 777,
      title: 'Different localized title',
      type: 'anime',
      release_year: '2024',
    })

    expect(match.title).toBe('Example Series')
    expect(match.type).toBe('show')
    db.close()
  })

  it('prefers an exact release year for remakes with the same title', () => {
    const db = createDb()
    insertMedia(db, { title: 'Dune', type: 'movie', release_year: '1984' })
    insertMedia(db, { title: 'Dune', type: 'movie', release_year: '2021' })

    const match = findExistingMediaInDatabase(db, {
      title: '  DUNE  ',
      type: 'movie',
      release_year: '2021',
    })

    expect(match.release_year).toBe('2021')
    db.close()
  })

  it('allows an undated saved entry to match a dated import', () => {
    const db = createDb()
    insertMedia(db, { title: 'Perfect Blue', type: 'anime', release_year: '' })

    const match = findExistingMediaInDatabase(db, {
      title: 'Perfect Blue',
      type: 'show',
      release_year: '1997',
    })

    expect(match.title).toBe('Perfect Blue')
    db.close()
  })

  it('does not match incompatible release years when no undated entry exists', () => {
    const db = createDb()
    insertMedia(db, { title: 'The Thing', type: 'movie', release_year: '1982' })

    expect(findExistingMediaInDatabase(db, {
      title: 'The Thing',
      type: 'movie',
      release_year: '2011',
    })).toBeNull()
    db.close()
  })
})
`)
