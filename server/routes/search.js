import { Router } from 'express'
import { e2eTmdbFixtureResults, useE2eTmdbFixtures } from '../e2e-fixtures.js'
import { applyKnownTitleCorrection } from '../known-media.js'

export function createSearchRouter({ hydrateTmdb, mapTmdbResult, parseSearchQuery, rankTmdbResults, tmdbFetch }) {
  const router = Router()
  router.get('/tmdb', async (req, res) => {
    try {
      const correctedQuery = applyKnownTitleCorrection(String(req.query.q || '').trim())
      if (!correctedQuery) return res.json([])
      if (useE2eTmdbFixtures) return res.json(e2eTmdbFixtureResults)

      const hints = parseSearchQuery(correctedQuery)
      const data = await tmdbFetch(`https://api.themoviedb.org/3/search/multi?language=en-US&include_adult=false&query=${encodeURIComponent(hints.title)}`)
      const ranked = rankTmdbResults(hints.title, data.results, {
        preferredType: hints.preferredType,
        preferredYear: hints.preferredYear,
      })
      const items = ranked
        .slice(0, 8)
        .map(({ item }) => mapTmdbResult(item, item.media_type))
      const hydrated = await Promise.all(items.slice(0, 5).map((item) => hydrateTmdb(item, item.type === 'show' ? 'tv' : 'movie')))
      res.json(hydrated.concat(items.slice(5)))
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  return router
}
