import { Router } from 'express'
import { db } from '../db.js'
import {
  bindMediaPayload,
  insertMedia,
  mediaRows,
  rowToMedia,
} from '../media-store.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(mediaRows())
})

router.post('/', (req, res) => {
  try {
    const saved = insertMedia(req.body)
    res.status(saved.duplicate ? 200 : 201).json(saved)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.patch('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Media not found' })

    const merged = bindMediaPayload({ ...rowToMedia(existing), ...req.body })
    if (merged.status === 'Watched' && !existing.completed_at) merged.completed_at = new Date().toISOString()
    if (merged.status !== 'Watched') {
      merged.completed_at = null
      merged.personal_rating = null
    }

    db.prepare(`
      UPDATE media SET
        tmdb_id=@tmdb_id, title=@title, type=@type, cover_art=@cover_art, genres=@genres, tags=@tags,
        description=@description, runtime=@runtime, release_year=@release_year, tmdb_rating=@tmdb_rating,
        status=@status, priority=@priority, personal_rating=@personal_rating, reflection=@reflection,
        season=@season, episode=@episode, completed_at=@completed_at, reminder_at=@reminder_at,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=@id
    `).run({ ...merged, id: req.params.id })

    res.json(rowToMedia(db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)))
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

export { router as mediaRouter }
