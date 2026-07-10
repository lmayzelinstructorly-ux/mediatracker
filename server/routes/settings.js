import { Router } from 'express'
import { settingsObject } from '../backup.js'
import { db } from '../db.js'
import { parseJson } from '../media-store.js'
import { geminiModelQueue } from '../services/gemini.js'

export function createSettingsRouter({ tmdbConfigured }) {
  const router = Router()
  router.get('/', (_req, res) => {
    res.json({
      api: {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        tmdbConfigured,
        geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
        geminiFallbacks: geminiModelQueue(),
      },
      preferences: settingsObject(db, parseJson),
    })
  })

  router.post('/', (req, res) => {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    Object.entries(req.body || {}).forEach(([key, value]) => upsert.run(key, JSON.stringify(value)))
    res.json({ ok: true })
  })
  return router
}
