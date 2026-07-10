import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { findExistingMediaInDatabase } from '../server/media-lookup.js'
import { runSchemaMigrations } from '../server/migrations/index.js'

function createDb() {
  const db = new Database(':memory:')
  runSchemaMigrations(db)
  return db
}

function insertMedia(db, { tmdb_id = null, title, type, release_year = '', updated_at = '2026-07-10 12:00:00' }) {
  return db.prepare(`
    INSERT INTO media (tmdb_id, title, type, release_year, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tmdb_id, title, type, release_year, updated_at)
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
