import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { applyKnownTitleCorrection, findKnownCollection, selectedCollectionTitles } from './known-media.js'
import { mediaIdentityKey, mediaRows, normalizeExistingLibrary, insertMedia, splitTrailingReleaseYear } from './media-store.js'
import { backupRouter } from './routes/backups.js'
import { createHealthRouter } from './routes/health.js'
import { createImportRouter } from './routes/imports.js'
import { mediaRouter } from './routes/media.js'
import { recommendationsRouter } from './routes/recommendations.js'
import { createSearchRouter } from './routes/search.js'
import { createSettingsRouter } from './routes/settings.js'
import { statsRouter } from './routes/stats.js'
import { geminiJsonArray } from './services/gemini.js'
import { createPdfImportService } from './services/pdf-import.js'
import { createTmdbService } from './services/tmdb.js'
import { watchlistUpload } from './upload.js'

const app = express()
const PORT = Number(process.env.PORT || 3000)
const tmdbKey = process.env.TMDB_API_KEY
const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN
const tmdbConfigured = Boolean(tmdbKey || tmdbToken)
const tmdb = createTmdbService({
  tmdbKey,
  tmdbToken,
  posterBase: 'https://image.tmdb.org/t/p/w500',
})
const { importWatchlistFromPdf } = createPdfImportService({
  mediaRows,
  mediaIdentityKey,
  insertMedia,
  findBestTmdb: tmdb.findBestTmdb,
  geminiJsonArray,
  applyKnownTitleCorrection,
  findKnownCollection,
  selectedCollectionTitles,
  splitTrailingReleaseYear,
})

normalizeExistingLibrary()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/api/health', createHealthRouter({ tmdbConfigured }))
app.use('/api/media', mediaRouter)
app.use('/api/search', createSearchRouter(tmdb))
app.use('/api/recommendations', recommendationsRouter)
app.use('/api/import', createImportRouter({ importWatchlistFromPdf, upload: watchlistUpload }))
app.use('/api/backup', backupRouter)
app.use('/api/stats', statsRouter)
app.use('/api/settings', createSettingsRouter({ tmdbConfigured }))

app.listen(PORT, () => {
  console.log(`MediaTracker API listening on http://localhost:${PORT}`)
})
