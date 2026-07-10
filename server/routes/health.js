import { Router } from 'express'
import { geminiModelQueue } from '../services/gemini.js'

export function createHealthRouter({ tmdbConfigured }) {
  const router = Router()
  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      tmdbConfigured,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      geminiFallbacks: geminiModelQueue(),
    })
  })
  return router
}
