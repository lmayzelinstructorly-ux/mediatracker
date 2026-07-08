import { describe, expect, it } from 'vitest'

import {
  applyKnownTitleCorrection,
  findKnownCollection,
  knownCollectionForTitle,
  selectedCollectionTitles,
} from '../server/known-media.js'

describe('known media helpers', () => {
  it('applies known title corrections', () => {
    expect(applyKnownTitleCorrection('tomadachi game')).toBe('Tomodachi Game')
    expect(applyKnownTitleCorrection('2025 spiderman')).toBe('Superman 2025')
  })

  it('finds The Dark Knight trilogy', () => {
    const collection = findKnownCollection('the dark knight trilogy')

    expect(collection).toMatchObject({
      label: 'The Dark Knight trilogy',
      titles: ['Batman Begins', 'The Dark Knight', 'The Dark Knight Rises'],
    })
  })

  it('selects a numbered range from a known collection', () => {
    const collection = findKnownCollection('rush hour 1 and 2')

    expect(selectedCollectionTitles('rush hour 1 and 2', collection)).toEqual([
      'Rush Hour',
      'Rush Hour 2',
    ])
  })

  it('handles excluding the first for a known collection', () => {
    const collection = findKnownCollection('the dark knight trilogy excluding the first')

    expect(selectedCollectionTitles('the dark knight trilogy excluding the first', collection)).toEqual([
      'The Dark Knight',
      'The Dark Knight Rises',
    ])
  })

  it('recognizes a title inside a known collection', () => {
    expect(knownCollectionForTitle('The Dark Knight')).toMatchObject({
      label: 'The Dark Knight trilogy',
    })
  })
})
