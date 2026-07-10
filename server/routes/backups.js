import { Router } from 'express'
import { backupDuplicateSummary, backupMediaPlan, backupSchema, settingsObject } from '../backup.js'
import { db } from '../db.js'
import { findExistingMedia, insertMedia, mediaIdentityKey, mediaRows, parseJson } from '../media-store.js'

const router = Router()

router.get('/export', (_req, res) => {
  res.json({
    schema: backupSchema,
    exported_at: new Date().toISOString(),
    media: mediaRows(),
    settings: settingsObject(db, parseJson),
  })
})

router.post('/preview', (req, res) => {
  try {
    const plan = backupMediaPlan(req.body, { mediaRows, mediaIdentityKey, findExistingMedia })
    res.json({
      ok: true,
      total: plan.total,
      willCreate: plan.create.length,
      create: plan.create.map(backupDuplicateSummary),
      duplicates: plan.duplicates,
      invalid: plan.invalid,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/restore', (req, res) => {
  try {
    if (req.body?.mode !== 'merge') return res.status(400).json({ error: 'Only merge restore mode is supported' })

    const plan = backupMediaPlan(req.body.backup, { mediaRows, mediaIdentityKey, findExistingMedia })
    const created = []
    const skipped = [...plan.duplicates]

    for (const item of plan.create) {
      const saved = insertMedia(item)
      if (saved.duplicate) skipped.push(backupDuplicateSummary(saved))
      else created.push(saved)
    }

    if (plan.settings) {
      const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      Object.entries(plan.settings).forEach(([key, value]) => upsert.run(key, JSON.stringify(value)))
    }

    res.json({ ok: true, created, skipped, invalid: plan.invalid })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export { router as backupRouter }
