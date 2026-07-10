import { Router } from 'express'

export function createImportRouter({ importWatchlistFromPdf, upload }) {
  const router = Router()
  router.post('/pdf', upload.single('watchlist'), async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'Attach a PDF file named watchlist.' })
      res.json(await importWatchlistFromPdf(req.file.buffer))
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  return router
}
