import { describe, expect, it } from 'vitest'

import {
  buildCustomMedia,
  buildResolvedMedia,
  hasNeedsReview,
  withoutNeedsReview,
} from '../src/lib/review.js'

const importedItem = {
  id: 12,
  title: 'Ambiguous Title',
  type: 'custom',
  status: 'Want to Watch',
  priority: 88,
  personal_rating: null,
  reflection: 'Imported note',
  season: 1,
  episode: 0,
  completed_at: null,
  reminder_at: '2026-08-01T15:00:00.000Z',
  genres: [],
  tags: ['PDF import', 'Needs review'],
}

describe('media review helpers', () => {
  it('detects and removes the Needs review tag case-insensitively', () => {
    expect(hasNeedsReview(importedItem)).toBe(true)
    expect(withoutNeedsReview(['PDF import', 'needs REVIEW', 'Drama'])).toEqual(['PDF import', 'Drama'])
  })

  it('applies selected metadata while preserving user-owned fields', () => {
    const resolved = buildResolvedMedia(importedItem, {
      tmdb_id: 99,
      title: 'Correct Film',
      type: 'movie',
      cover_art: '/poster.jpg',
      genres: ['Drama'],
      tags: ['Drama'],
      description: 'Correct metadata.',
      runtime: 121,
      release_year: '2024',
      tmdb_rating: 8.1,
    })

    expect(resolved).toMatchObject({
      id: 12,
      tmdb_id: 99,
      title: 'Correct Film',
      type: 'movie',
      status: 'Want to Watch',
      priority: 88,
      reflection: 'Imported note',
      reminder_at: '2026-08-01T15:00:00.000Z',
      release_year: '2024',
    })
    expect(resolved.tags).toEqual(['PDF import', 'Drama'])
    expect(resolved.genres).toEqual(['Drama'])
    expect(hasNeedsReview(resolved)).toBe(false)
  })

  it('keeps an unresolved item as custom and clears the warning', () => {
    const custom = buildCustomMedia(importedItem)

    expect(custom).toMatchObject({
      tmdb_id: null,
      type: 'custom',
      title: 'Ambiguous Title',
      status: 'Want to Watch',
    })
    expect(custom.tags).toEqual(['PDF import', 'Custom'])
    expect(hasNeedsReview(custom)).toBe(false)
  })
})
