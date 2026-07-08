import { describe, expect, it } from 'vitest'

import {
  backupMediaPlan,
  backupSchema,
  normalizeBackupMediaItem,
  parseBackupPayload,
} from '../server/backup.js'

describe('parseBackupPayload', () => {
  it('rejects missing object', () => {
    expect(() => parseBackupPayload(null)).toThrow('Backup must be a JSON object')
  })

  it('rejects wrong schema', () => {
    expect(() => parseBackupPayload({ schema: 'wrong.schema', media: [] })).toThrow(
      `Backup schema must be ${backupSchema}`,
    )
  })

  it('rejects non-array media', () => {
    expect(() => parseBackupPayload({ schema: backupSchema, media: {} })).toThrow(
      'Backup media must be an array',
    )
  })

  it('accepts valid framelog.backup.v1 backup', () => {
    const backup = { schema: backupSchema, media: [], settings: { theme: 'dark' } }

    expect(parseBackupPayload(backup)).toBe(backup)
  })
})

describe('normalizeBackupMediaItem', () => {
  it('trims title and fills safe defaults', () => {
    const { item, invalid } = normalizeBackupMediaItem({ title: '  Cowboy Bebop  ' })

    expect(invalid).toBeNull()
    expect(item).toMatchObject({
      title: 'Cowboy Bebop',
      type: 'movie',
      cover_art: '',
      genres: [],
      tags: [],
      description: '',
      runtime: 0,
      release_year: '',
      status: 'Want to Watch',
      priority: 0,
      reflection: '',
      season: 1,
      episode: 0,
      completed_at: null,
      reminder_at: null,
    })
  })

  it('marks blank title invalid', () => {
    const { item, invalid } = normalizeBackupMediaItem({ title: '   ' })

    expect(item.title).toBe('')
    expect(invalid).toEqual({ title: '', reason: 'Title is required' })
  })
})

describe('backupMediaPlan', () => {
  it('reports create, duplicate, invalid, and same-file duplicate items', () => {
    const mediaRows = () => [{ title: 'Already Saved', type: 'movie' }]
    const mediaIdentityKey = (item) => `${item.type}:${item.title.toLowerCase()}`
    const findExistingMedia = (item) => item.title === 'Found By Lookup'

    const plan = backupMediaPlan(
      {
        schema: backupSchema,
        media: [
          { title: 'New Arrival', type: 'movie' },
          { title: 'Already Saved', type: 'movie' },
          { title: 'Found By Lookup', type: 'movie' },
          { title: '   ' },
          { title: 'New Arrival', type: 'movie' },
        ],
      },
      { mediaRows, mediaIdentityKey, findExistingMedia },
    )

    expect(plan.total).toBe(5)
    expect(plan.create).toHaveLength(1)
    expect(plan.create[0]).toMatchObject({ title: 'New Arrival', type: 'movie' })
    expect(plan.duplicates).toEqual([
      { title: 'Already Saved', type: 'movie', status: 'Want to Watch' },
      { title: 'Found By Lookup', type: 'movie', status: 'Want to Watch' },
      { title: 'New Arrival', type: 'movie', status: 'Want to Watch' },
    ])
    expect(plan.invalid).toEqual([{ title: '', reason: 'Title is required' }])
  })
})
