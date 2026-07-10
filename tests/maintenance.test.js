import { describe, expect, it, vi } from 'vitest'

import {
  libraryNormalizationMigrationKey,
  runLibraryNormalizationMigration,
} from '../server/maintenance.js'

function fakeDb(existingValue) {
  const run = vi.fn()
  return {
    run,
    db: {
      prepare(sql) {
        if (sql.includes('SELECT value')) {
return { get: vi.fn(() => existingValue ? { value: existingValue } : undefined) }
        }
        return { run }
      },
    },
  }
}

describe('runLibraryNormalizationMigration', () => {
  it('runs maintenance and records completion once', () => {
    const { db, run } = fakeDb(null)
    const normalizeLibrary = vi.fn()

    expect(runLibraryNormalizationMigration({
      db,
      normalizeLibrary,
      completedAt: '2026-07-10T12:00:00.000Z',
    })).toBe(true)
    expect(normalizeLibrary).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledWith(
      libraryNormalizationMigrationKey,
      JSON.stringify({ completed_at: '2026-07-10T12:00:00.000Z' }),
    )
  })

  it('skips maintenance after the migration is recorded', () => {
    const { db, run } = fakeDb('{"completed_at":"earlier"}')
    const normalizeLibrary = vi.fn()

    expect(runLibraryNormalizationMigration({ db, normalizeLibrary })).toBe(false)
    expect(normalizeLibrary).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })
})
