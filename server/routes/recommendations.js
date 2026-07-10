import { Router } from 'express'
import { e2eGeminiFixtureRecommendations, useE2eGeminiFixtures } from '../e2e-fixtures.js'
import { librarySnapshot } from '../media-store.js'
import { geminiRecommendations } from '../services/gemini.js'

const router = Router()
router.post('/', async (req, res) => {
  try {
    const { mode = 'personalized', context = '' } = req.body
    res.json(await geminiRecommendations(mode, context, {
      librarySnapshot,
      useE2eGeminiFixtures,
      e2eGeminiFixtureRecommendations,
    }))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export { router as recommendationsRouter }
