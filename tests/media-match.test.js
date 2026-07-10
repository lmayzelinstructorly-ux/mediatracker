import { describe, expect, it } from 'vitest'

import {
  parseSearchQuery,
  rankTmdbResults,
  selectBestTmdbMatch,
} from '../server/services/media-match.js'

describe('TMDB candidate matching', () => {
  it('prefers an exact title over a more popular partial match', () => {
    const results = [
      { id: 2, media_type: 'movie', title: 'Dune: Part Two', release_date: '2024-01-01', popularity: 1000 },
      { id: 1, media_type: 'movie', title: 'Dune', release_date: '2021-01-01', popularity: 20 },
    ]

    expect(selectBestTmdbMatch('Dune', results, { preferredType: 'movie' })?.id).toBe(1)
  })

  it('uses year and media type to distinguish remakes and shows', () => {
    const results = [
      { id: 1, media_type: 'movie', title: 'Dune', release_date: '1984-01-01' },
      { id: 2, media_type: 'tv', name: 'Dune', first_air_date: '2000-01-01' },
      { id: 3, media_type: 'movie', title: 'Dune', release_date: '2021-01-01' },
    ]

    expect(selectBestTmdbMatch('Dune', results, { preferredType: 'movie', preferredYear: '2021' })?.id).toBe(3)
  })

  it('rejects an exact movie versus show tie when the source gives no hints', () => {
    const results = [
      { id: 1, media_type: 'movie', title: 'The Office', release_date: '2015-01-01', popularity: 10 },
      { id: 2, media_type: 'tv', name: 'The Office', first_air_date: '2005-01-01', popularity: 100 },
    ]

    expect(selectBestTmdbMatch('The Office', results)).toBeNull()
  })

  it('uses anime evidence without forcing anime to be a TV show', () => {
    const results = [
      { id: 1, media_type: 'tv', name: 'Your Name', first_air_date: '2010-01-01', genre_ids: [18], original_language: 'en' },
      { id: 2, media_type: 'movie', title: 'Your Name.', release_date: '2016-01-01', genre_ids: [16, 18], original_language: 'ja' },
    ]

    expect(selectBestTmdbMatch('Your Name', results, { preferredType: 'anime', preferredYear: '2016' })?.id).toBe(2)
  })

  it('ranks close results using title evidence before popularity', () => {
    const ranked = rankTmdbResults('Arrival', [
      { id: 1, media_type: 'movie', title: 'The Arrival', release_date: '1996-01-01', popularity: 200 },
      { id: 2, media_type: 'movie', title: 'Arrival', release_date: '2016-01-01', popularity: 10 },
    ])

    expect(ranked[0].item.id).toBe(2)
  })
})

describe('parseSearchQuery', () => {
  it('extracts trailing year and type hints', () => {
    expect(parseSearchQuery('Dune movie (2021)')).toEqual({
      title: 'Dune',
      preferredType: 'movie',
      preferredYear: '2021',
    })
  })
})
