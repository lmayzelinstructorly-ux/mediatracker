import { Router } from 'express'
import { e2eTmdbFixtureResults, useE2eTmdbFixtures } from '../e2e-fixtures.js'
import { applyKnownTitleCorrection } from '../known-media.js'

export function createSearchRouter({ hydrateTmdb, mapTmdbResult, tmdbFetch }) {
  const router = Router()
  router.get('/tmdb', async (req, res) => {
    try {
      const query = applyKnownTitleCorrection(String(req.query.q || '').trim())
      if (!query) return res.json([])
      if (useE2eTmdbFixtures) return res.json(e2eTmdbFixtureResults)
      const data = await tmdbFetch(`https://api.themoviedb.org/3/search/multi?language=en-US&include_adult=false&query=${encodeURIComponent(query)}`)
      const items = (data.results || [])
        .filter((item) => ['movie', 'tv'].includes(item.media_type))
        .slice(0, 8)
        .map((item) => mapTmdbResult(item, item.media_type))
      const hydrated = await Promise.all(items.slice(0, 5).map((item) => hydrateTmdb(item, item.type === 'show' ? 'tv' : 'movie')))
      res.json(hydrated.concat(items.slice(5)))
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  return router
}
