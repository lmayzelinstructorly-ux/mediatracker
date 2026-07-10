export const useE2eTmdbFixtures = process.env.FRAMELOG_E2E_TMDB_FIXTURES === 'true'
export const useE2eGeminiFixtures = process.env.FRAMELOG_E2E_GEMINI_FIXTURES === 'true'

export const e2eTmdbFixtureResults = [
  {
    tmdb_id: 909090,
    title: 'Fixture Galaxy Quest',
    type: 'movie',
    cover_art: '',
    genres: ['Adventure', 'Comedy'],
    tags: ['Adventure', 'Comedy'],
    description: 'A deterministic TMDB-style fixture used for e2e testing.',
    runtime: 102,
    release_year: '1999',
    tmdb_rating: 7.1,
  },
  {
    tmdb_id: 909091,
    title: 'Fixture Review Match',
    type: 'show',
    cover_art: '',
    genres: ['Mystery', 'Drama'],
    tags: ['Mystery', 'Drama'],
    description: 'A second deterministic TMDB-style fixture reserved for review workflow testing.',
    runtime: 48,
    release_year: '2024',
    tmdb_rating: 8.2,
  },
]

export const e2eGeminiFixtureRecommendations = [
  {
    title: 'Fixture Neon Harbor',
    type: 'movie',
    reason: 'A deterministic recommendation used for e2e testing.',
    mood: 'moody sci-fi',
    confidence: 91,
  },
  {
    title: 'Fixture Quiet Signal',
    type: 'tv',
    reason: 'Another stable recommendation for Playwright coverage.',
    mood: 'slow-burn mystery',
    confidence: 84,
  },
]
