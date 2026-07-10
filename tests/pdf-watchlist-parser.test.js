import { describe, expect, it } from 'vitest'

import {
  mergeExtractedItems,
  parseWatchlistLines,
  splitPdfTitleAndNote,
} from '../server/services/pdf-watchlist-parser.js'

describe('parseWatchlistLines', () => {
  it('extracts numbered, checkbox, table, type, year, note, and section metadata', () => {
    const items = parseWatchlistLines(`
      PLANNING TO WATCH
      1. Arrival (2016) [Movie]
      2) Dark [TV] -- recommended by Sam
      WANT TO REWATCH
      [ ] Spirited Away | Anime | 2001
      HAVE WATCHED
      The Matrix | Movie | 1999
    `)

    expect(items).toHaveLength(4)
    expect(items[0]).toMatchObject({ title: 'Arrival', type: 'movie', release_year: '2016', status: 'Want to Watch' })
    expect(items[1]).toMatchObject({ title: 'Dark', type: 'show', notes: 'recommended by Sam' })
    expect(items[2]).toMatchObject({ title: 'Spirited Away', type: 'anime', release_year: '2001', status: 'Want to Rewatch' })
    expect(items[3]).toMatchObject({ title: 'The Matrix', type: 'movie', release_year: '1999', status: 'Watched' })
  })

  it('ignores page markers, column headings, dates, and prose', () => {
    const items = parseWatchlistLines(`
      WATCHLIST
      Title | Year | Type | Status
      Page 1 of 2
      Generated on 2026-07-10
      This is a sentence explaining how the list was made.
      - Heat
    `)

    expect(items.map((item) => item.title)).toEqual(['Heat'])
  })
})

describe('splitPdfTitleAndNote', () => {
  it('preserves real parenthetical title text but extracts metadata', () => {
    expect(splitPdfTitleAndNote('Birdman or (The Unexpected Virtue of Ignorance) [Movie] [2014]')).toMatchObject({
      title: 'Birdman or (The Unexpected Virtue of Ignorance)',
      type: 'movie',
      release_year: '2014',
    })
  })
})

describe('mergeExtractedItems', () => {
  it('keeps deterministic titles omitted by AI and merges stronger AI metadata', () => {
    const merged = mergeExtractedItems({
      text: 'PLANNING TO WATCH\n- Arrival\n- Heat',
      fallbackItems: [
        { title: 'Arrival', type: 'custom', status: 'Want to Watch', priority: 1000, tags: ['PDF import'] },
        { title: 'Heat', type: 'custom', status: 'Want to Watch', priority: 999, tags: ['PDF import'] },
      ],
      aiItems: [
        { title: 'Arrival', type: 'movie', status: 'Want to Watch', release_year: '2016', priority: 80, tags: ['Science Fiction'] },
        { title: 'Invented Movie', type: 'movie', status: 'Want to Watch' },
      ],
    })

    expect(merged.map((item) => item.title)).toEqual(['Arrival', 'Heat'])
    expect(merged[0]).toMatchObject({ type: 'movie', release_year: '2016', priority: 1000 })
    expect(merged[0].tags).toEqual(expect.arrayContaining(['PDF import', 'Science Fiction']))
  })
})
