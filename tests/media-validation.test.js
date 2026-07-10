import { describe, expect, it } from 'vitest'

import { normalizeMediaPayload } from '../server/media-validation.js'

describe('normalizeMediaPayload', () => {
  it('normalizes a valid media payload', () => {
    expect(normalizeMediaPayload({
      title: '  Arrival  ',
      type: 'movie',
      status: 'Watched',
      genres: ['Drama', 'Drama', ' Science Fiction '],
      runtime: '116',
      release_year: 2016,
      personal_rating: 9,
      completed_at: '2026-07-10T12:00:00Z',
    })).toMatchObject({
      title: 'Arrival',
      type: 'movie',
      status: 'Watched',
      genres: ['Drama', 'Science Fiction'],
      tags: ['Drama', 'Science Fiction'],
      runtime: 116,
      release_year: '2016',
      personal_rating: 9,
      completed_at: '2026-07-10T12:00:00.000Z',
    })
  })

  it.each([
    [{ title: '' }, 'Title is required'],
    [{ title: 'Test', type: 'podcast' }, 'type must be one of'],
    [{ title: 'Test', status: 'Finished' }, 'status must be one of'],
    [{ title: 'Test', personal_rating: 11 }, 'personal_rating must be a number between 1 and 10'],
    [{ title: 'Test', runtime: -1 }, 'runtime must be an integer'],
    [{ title: 'Test', season: 0 }, 'season must be an integer'],
    [{ title: 'Test', episode: -1 }, 'episode must be an integer'],
    [{ title: 'Test', reminder_at: 'not-a-date' }, 'reminder_at must be a valid date'],
    [{ title: 'Test', genres: 'Drama' }, 'genres must be an array of strings'],
  ])('rejects invalid media data %#', (payload, message) => {
    expect(() => normalizeMediaPayload(payload)).toThrow(message)
  })

  it('does not assign a completion date to an unwatched title', () => {
    expect(normalizeMediaPayload({
      title: 'Future Watch',
      status: 'Want to Watch',
      completed_at: '2026-07-10T12:00:00Z',
    }).completed_at).toBeNull()
  })
})
