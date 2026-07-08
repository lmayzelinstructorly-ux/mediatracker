import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTmdbService } from '../server/services/tmdb.js'

describe('createTmdbService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('appends api_key when tmdbKey is provided', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const service = createTmdbService({
      tmdbKey: 'test-key',
      tmdbToken: '',
      posterBase: 'https://image.tmdb.org/t/p/w500',
    })

    await service.tmdbFetch('https://api.themoviedb.org/3/search/movie?query=Arrival')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/search/movie?query=Arrival&api_key=test-key',
      { headers: {} },
    )
  })

  it('uses Authorization header when tmdbToken is provided', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const service = createTmdbService({
      tmdbKey: '',
      tmdbToken: 'read-token',
      posterBase: 'https://image.tmdb.org/t/p/w500',
    })

    await service.tmdbFetch('https://api.themoviedb.org/3/search/movie')

    expect(fetchMock).toHaveBeenCalledWith('https://api.themoviedb.org/3/search/movie', {
      headers: { Authorization: 'Bearer read-token' },
    })
  })

  it('maps movie result fields correctly', () => {
    const service = createTmdbService({
      tmdbKey: '',
      tmdbToken: '',
      posterBase: 'https://poster.example',
    })

    expect(
      service.mapTmdbResult(
        {
          id: 329865,
          title: 'Arrival',
          release_date: '2016-11-11',
          poster_path: '/arrival.jpg',
          overview: 'A linguist works with the military to communicate with aliens.',
          vote_average: 7.945,
        },
        'movie',
      ),
    ).toEqual({
      tmdb_id: 329865,
      title: 'Arrival',
      type: 'movie',
      cover_art: 'https://poster.example/arrival.jpg',
      description: 'A linguist works with the military to communicate with aliens.',
      release_year: '2016',
      tmdb_rating: 7.9,
      genres: [],
      tags: [],
      runtime: 0,
    })
  })

  it('maps tv result type to show', () => {
    const service = createTmdbService({
      tmdbKey: '',
      tmdbToken: '',
      posterBase: 'https://poster.example',
    })

    expect(
      service.mapTmdbResult(
        {
          id: 1396,
          name: 'Breaking Bad',
          first_air_date: '2008-01-20',
          vote_average: 8.9,
        },
        'tv',
      ),
    ).toMatchObject({
      tmdb_id: 1396,
      title: 'Breaking Bad',
      type: 'show',
      release_year: '2008',
      tmdb_rating: 8.9,
    })
  })

  it('hydrates genres and runtime from details', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        runtime: 116,
        genres: [{ name: 'Science Fiction' }, { name: 'Drama' }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const service = createTmdbService({
      tmdbKey: '',
      tmdbToken: '',
      posterBase: 'https://poster.example',
    })

    await expect(
      service.hydrateTmdb(
        {
          tmdb_id: 329865,
          title: 'Arrival',
          type: 'movie',
          genres: [],
          tags: [],
          runtime: 0,
        },
        'movie',
      ),
    ).resolves.toMatchObject({
      genres: ['Science Fiction', 'Drama'],
      tags: ['Science Fiction', 'Drama'],
      runtime: 116,
    })
  })

  it('findBestTmdb returns null if fetch fails', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'server error',
    }))
    vi.stubGlobal('fetch', fetchMock)

    const service = createTmdbService({
      tmdbKey: '',
      tmdbToken: '',
      posterBase: 'https://poster.example',
    })

    await expect(service.findBestTmdb('Arrival', 'movie')).resolves.toBeNull()
  })
})
