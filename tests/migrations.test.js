import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { runSchemaMigrations, schemaMigrations } from '../server/migrations/index.js'

function legacySchema(db) {
  db.exec(`
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
  `)
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
