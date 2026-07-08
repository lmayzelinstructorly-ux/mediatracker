import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { PDFParse } from 'pdf-parse'
import {
  e2eGeminiFixtureRecommendations,
  e2eTmdbFixtureResults,
  useE2eGeminiFixtures,
  useE2eTmdbFixtures,
} from './e2e-fixtures.js'
import { db } from './db.js'
import {
  backupDuplicateSummary,
  backupMediaPlan,
  backupSchema,
  settingsObject,
} from './backup.js'
import {
  applyKnownTitleCorrection,
  findKnownCollection,
  knownCollectionForTitle,
  knownCollectionTitle,
  selectedCollectionTitles,
  titleMatchKey,
} from './known-media.js'
import {
  geminiJsonArray,
  geminiModelQueue,
  geminiRecommendations,
} from './services/gemini.js'
import { createTmdbService } from './services/tmdb.js'

const app = express()
const PORT = Number(process.env.PORT || 3000)
const tmdbKey = process.env.TMDB_API_KEY
const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN
const posterBase = 'https://image.tmdb.org/t/p/w500'
const {
  tmdbFetch,
  mapTmdbResult,
  hydrateTmdb,
  findBestTmdb,
} = createTmdbService({ tmdbKey, tmdbToken, posterBase })
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true)
      return
    }
    cb(new Error('Please upload a PDF file.'))
  },
})

app.use(cors())
app.use(express.json({ limit: '1mb' }))

function parseJson(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

function rowToMedia(row) {
  return {
    ...row,
    genres: parseJson(row.genres),
    tags: parseJson(row.tags),
  }
}

function mediaRows() {
  return db
    .prepare('SELECT * FROM media ORDER BY status, priority DESC, updated_at DESC')
    .all()
    .map(rowToMedia)
}

function normalizeMediaTitle(title) {
  return String(title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function splitTrailingReleaseYear(title) {
  const match = String(title || '').trim().match(/^(.*?)\s*(?:\((19\d{2}|20\d{2})\)|\[(19\d{2}|20\d{2})\]|(19\d{2}|20\d{2}))$/)
  if (!match) return { title: String(title || '').trim(), year: '' }

  const cleanTitle = match[1].trim()
  const year = match[2] || match[3] || match[4] || ''
  if (!cleanTitle) return { title: String(title || '').trim(), year: '' }
  return { title: cleanTitle, year }
}

function mediaTypeFamily(type) {
  return type === 'anime' ? 'show' : type || 'movie'
}

function mediaIdentityKey(item) {
  const type = mediaTypeFamily(item.type)
  if (item.tmdb_id != null) return `tmdb|${type}|${item.tmdb_id}`
  return `title|${type}|${normalizeMediaTitle(item.title)}|${item.release_year || ''}`
}

function uniqueJsonArray(...values) {
  return uniqueList(values.flatMap((value) => parseJson(value)))
}

const knownMediaMetadata = new Map([
  ['superman|2025', {
    tmdb_id: 1061474,
    title: 'Superman',
    type: 'movie',
    cover_art: 'https://image.tmdb.org/t/p/w500/ldyfo0BKmz5rWtJJKCvwaNS4cJT.jpg',
    genres: ['Science Fiction', 'Adventure', 'Action'],
    tags: ['Science Fiction', 'Adventure', 'Action'],
    description: 'Superman, a journalist in Metropolis, embarks on a journey to reconcile his Kryptonian heritage with his human upbringing as Clark Kent.',
    runtime: 130,
    release_year: '2025',
    tmdb_rating: 7.3,
  }],
  ['rush hour|1998', {
    tmdb_id: 2109,
    title: 'Rush Hour',
    type: 'movie',
    cover_art: 'https://image.tmdb.org/t/p/w500/we7wOLVFgxhzLzUt0qNe50xdIQZ.jpg',
    genres: ['Action', 'Comedy', 'Crime'],
    tags: ['Action', 'Comedy', 'Crime'],
    description: 'When Hong Kong Inspector Lee is summoned to Los Angeles to investigate a kidnapping, the FBI assigns cocky LAPD Detective James Carter to distract him. Lee and Carter form an unlikely partnership and investigate the case themselves.',
    runtime: 97,
    release_year: '1998',
    tmdb_rating: 7.1,
  }],
  ['rush hour 2|2001', {
    tmdb_id: 5175,
    title: 'Rush Hour 2',
    type: 'movie',
    cover_art: 'https://image.tmdb.org/t/p/w500/aBQf2vMiCINeVC9v6BGVYKXurTh.jpg',
    genres: ['Action', 'Comedy', 'Crime'],
    tags: ['Action', 'Comedy', 'Crime'],
    description: 'Carter and Lee travel to Hong Kong and stumble into a counterfeiting plot while investigating an embassy bombing.',
    runtime: 90,
    release_year: '2001',
    tmdb_rating: 6.8,
  }],
])

function preferredDuplicateRow(left, right) {
  const statusScore = { Watched: 3, 'Want to Watch': 2, 'Want to Rewatch': 1 }
  const leftScore = statusScore[left.status] || 0
  const rightScore = statusScore[right.status] || 0
  if (leftScore !== rightScore) return leftScore > rightScore ? left : right

  const leftTitle = normalizeMediaTitle(left.title)
  const rightTitle = normalizeMediaTitle(right.title)
  if (leftTitle !== rightTitle && left.title.length !== right.title.length) {
    return left.title.length > right.title.length ? left : right
  }

  const leftTime = new Date(left.updated_at || left.created_at || 0).getTime()
  const rightTime = new Date(right.updated_at || right.created_at || 0).getTime()
  if (leftTime !== rightTime) return leftTime > rightTime ? left : right
  return left.id > right.id ? left : right
}

function dedupeExistingMedia() {
  const rows = db.prepare('SELECT * FROM media ORDER BY id').all()
  const groups = new Map()

  for (const row of rows) {
    const key = mediaIdentityKey(row)
    if (!normalizeMediaTitle(row.title)) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  const update = db.prepare(`
    UPDATE media SET
      cover_art=@cover_art, genres=@genres, tags=@tags, description=@description, runtime=@runtime,
      release_year=@release_year, tmdb_rating=@tmdb_rating, priority=@priority, personal_rating=@personal_rating,
      reflection=@reflection, season=@season, episode=@episode, completed_at=@completed_at,
      reminder_at=@reminder_at, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `)
  const remove = db.prepare('DELETE FROM media WHERE id = ?')

  const transaction = db.transaction(() => {
    for (const duplicates of groups.values()) {
      if (duplicates.length < 2) continue

      const keeper = duplicates.reduce(preferredDuplicateRow)
      const others = duplicates.filter((row) => row.id !== keeper.id)
      const richRows = [keeper, ...others]
      update.run({
        id: keeper.id,
        cover_art: richRows.find((row) => row.cover_art)?.cover_art || '',
        genres: JSON.stringify(uniqueJsonArray(...richRows.map((row) => row.genres))),
        tags: JSON.stringify(uniqueJsonArray(...richRows.map((row) => row.tags))),
        description: richRows.find((row) => row.description)?.description || '',
        runtime: Math.max(...richRows.map((row) => Number(row.runtime) || 0)),
        release_year: richRows.find((row) => row.release_year)?.release_year || '',
        tmdb_rating: richRows.find((row) => row.tmdb_rating)?.tmdb_rating || null,
        priority: Math.max(...richRows.map((row) => Number(row.priority) || 0)),
        personal_rating: richRows.find((row) => row.personal_rating)?.personal_rating || null,
        reflection: richRows.find((row) => row.reflection)?.reflection || '',
        season: Math.max(...richRows.map((row) => Number(row.season) || 1)),
        episode: Math.max(...richRows.map((row) => Number(row.episode) || 0)),
        completed_at: richRows.find((row) => row.completed_at)?.completed_at || null,
        reminder_at: richRows.find((row) => row.reminder_at)?.reminder_at || null,
      })
      others.forEach((row) => remove.run(row.id))
    }
  })

  transaction()
}

function knownMetadataForTitle(title, preferredYear = '') {
  const key = titleMatchKey(title)
  const exact = knownMediaMetadata.get(`${key}|${preferredYear}`)
  if (exact) return exact

  return [...knownMediaMetadata.values()].find((item) => titleMatchKey(item.title) === key)
}

function repairExistingMedia() {
  const rows = db.prepare('SELECT * FROM media ORDER BY id').all()
  const update = db.prepare(`
    UPDATE media SET
      tmdb_id=@tmdb_id, title=@title, type=@type, cover_art=@cover_art, genres=@genres, tags=@tags,
      description=@description, runtime=@runtime, release_year=@release_year, tmdb_rating=@tmdb_rating,
      priority=@priority, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `)
  const updateTags = db.prepare('UPDATE media SET title = @title, type = @type, tags = @tags, updated_at=CURRENT_TIMESTAMP WHERE id = @id')
  const insert = db.prepare(`
    INSERT INTO media (
      tmdb_id, title, type, cover_art, genres, tags, description, runtime, release_year,
      tmdb_rating, status, priority, personal_rating, reflection, season, episode, completed_at, reminder_at,
      created_at, updated_at
    ) VALUES (
      @tmdb_id, @title, @type, @cover_art, @genres, @tags, @description, @runtime, @release_year,
      @tmdb_rating, @status, @priority, @personal_rating, @reflection, @season, @episode, @completed_at, @reminder_at,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `)
  const remove = db.prepare('DELETE FROM media WHERE id = ?')

  const findExisting = (title, type) =>
    db.prepare('SELECT * FROM media WHERE lower(title) = lower(?) AND type = ?').get(title, type)

  const applyMetadata = (row, metadata, extraTags = [], priority = row.priority) => {
    const collection = knownCollectionForTitle(metadata.title)
    const tags = uniqueList([
      ...parseJson(row.tags),
      ...(metadata.tags || []),
      ...extraTags,
      collection?.label,
      collection ? 'Collection' : '',
    ])
    update.run({
      id: row.id,
      tmdb_id: metadata.tmdb_id || row.tmdb_id || null,
      title: metadata.title,
      type: metadata.type || row.type || 'movie',
      cover_art: metadata.cover_art || row.cover_art || '',
      genres: JSON.stringify(metadata.genres || parseJson(row.genres)),
      tags: JSON.stringify(tags),
      description: metadata.description || row.description || '',
      runtime: metadata.runtime || row.runtime || 0,
      release_year: metadata.release_year || row.release_year || '',
      tmdb_rating: metadata.tmdb_rating || row.tmdb_rating || null,
      priority,
    })
  }

  const transaction = db.transaction(() => {
    for (const row of rows) {
      const importedCollection = findKnownCollection(row.title)
      const exactCollection = knownCollectionForTitle(row.title)

      if (importedCollection && !exactCollection) {
        const selectedTitles = selectedCollectionTitles(row.title, importedCollection)
        selectedTitles.forEach((title, index) => {
          const metadata = knownMetadataForTitle(title) || {
            title,
            type: 'movie',
            tags: [],
            genres: [],
          }
          const existing = findExisting(metadata.title, metadata.type || 'movie')
          const tags = uniqueList([
            ...parseJson(existing?.tags),
            ...parseJson(row.tags),
            ...(metadata.tags || []),
            importedCollection.label,
            'Collection',
          ])
          const payload = {
            tmdb_id: metadata.tmdb_id || existing?.tmdb_id || null,
            title: metadata.title,
            type: metadata.type || 'movie',
            cover_art: metadata.cover_art || existing?.cover_art || row.cover_art || '',
            genres: JSON.stringify(metadata.genres || parseJson(existing?.genres) || []),
            tags: JSON.stringify(tags),
            description: metadata.description || existing?.description || row.description || '',
            runtime: metadata.runtime || existing?.runtime || row.runtime || 0,
            release_year: metadata.release_year || existing?.release_year || '',
            tmdb_rating: metadata.tmdb_rating || existing?.tmdb_rating || null,
            status: existing?.status || row.status,
            priority: Math.max(1, (Number(row.priority) || selectedTitles.length) - index),
            personal_rating: existing?.personal_rating || row.personal_rating || null,
            reflection: existing?.reflection || row.reflection || '',
            season: existing?.season || row.season || 1,
            episode: existing?.episode || row.episode || 0,
            completed_at: existing?.completed_at || row.completed_at || null,
            reminder_at: existing?.reminder_at || row.reminder_at || null,
          }

          if (existing) {
            update.run({ ...payload, id: existing.id })
          } else {
            insert.run(payload)
          }
        })
        remove.run(row.id)
        continue
      }

      const corrected = applyKnownTitleCorrection(row.title)
      const parsedTitle = splitTrailingReleaseYear(corrected)
      const metadata = knownMetadataForTitle(parsedTitle.title, parsedTitle.year)
      if (metadata && titleMatchKey(row.title) !== titleMatchKey(metadata.title)) {
        applyMetadata(row, metadata)
        continue
      }

      if (exactCollection) {
        const canonicalTitle = knownCollectionTitle(row.title, exactCollection)
        const tags = uniqueList([...parseJson(row.tags), exactCollection.label, 'Collection'])
        updateTags.run({
          id: row.id,
          title: canonicalTitle,
          type: row.type === 'custom' ? 'movie' : row.type,
          tags: JSON.stringify(tags),
        })
      }
    }
  })

  transaction()
}

function normalizeExistingLibrary() {
  repairExistingMedia()
  dedupeExistingMedia()
}

normalizeExistingLibrary()

function bindMediaPayload(payload) {
  const status = payload.status || 'Want to Watch'
  const completedAt =
    status === 'Watched' ? payload.completed_at || new Date().toISOString() : null

  return {
    tmdb_id: payload.tmdb_id || null,
    title: payload.title?.trim(),
    type: payload.type || 'movie',
    cover_art: payload.cover_art || '',
    genres: JSON.stringify(payload.genres || []),
    tags: JSON.stringify(payload.tags || payload.genres || []),
    description: payload.description || '',
    runtime: payload.runtime || 0,
    release_year: payload.release_year || '',
    tmdb_rating: payload.tmdb_rating || null,
    status,
    priority: payload.priority || 0,
    personal_rating: payload.personal_rating || null,
    reflection: payload.reflection || '',
    season: payload.season || 1,
    episode: payload.episode || 0,
    completed_at: completedAt,
    reminder_at: payload.reminder_at || null,
  }
}

function findExistingMedia(payload) {
  const titleKey = normalizeMediaTitle(payload.title)
  if (!titleKey) return null

  const type = mediaTypeFamily(payload.type)
  const rows = db.prepare('SELECT * FROM media').all()
  const match = rows.find((row) => {
    if (mediaTypeFamily(row.type) !== type) return false
    if (payload.tmdb_id != null && row.tmdb_id != null) {
      return Number(row.tmdb_id) === Number(payload.tmdb_id)
    }

    const yearsCompatible = !payload.release_year || !row.release_year || String(payload.release_year) === String(row.release_year)
    return normalizeMediaTitle(row.title) === titleKey && yearsCompatible
  })
  return match ? rowToMedia(match) : null
}

function insertMedia(payload) {
  const mediaPayload = bindMediaPayload(payload)
  if (!mediaPayload.title) {
    throw new Error('Title is required')
  }

  const existing = findExistingMedia(mediaPayload)
  if (existing) {
    return { ...existing, duplicate: true }
  }

  const stmt = db.prepare(`
    INSERT INTO media (
      tmdb_id, title, type, cover_art, genres, tags, description, runtime, release_year,
      tmdb_rating, status, priority, personal_rating, reflection, season, episode, completed_at, reminder_at
    ) VALUES (
      @tmdb_id, @title, @type, @cover_art, @genres, @tags, @description, @runtime, @release_year,
      @tmdb_rating, @status, @priority, @personal_rating, @reflection, @season, @episode, @completed_at, @reminder_at
    )
  `)
  const result = stmt.run(mediaPayload)
  return rowToMedia(db.prepare('SELECT * FROM media WHERE id = ?').get(result.lastInsertRowid))
}

function librarySnapshot() {
  return mediaRows()
    .map((item) => `${item.title} (${item.type}, ${item.status}, genres: ${item.genres.join(', ') || 'none'}, rating: ${item.personal_rating || 'n/a'})`)
    .join('\n')
}

function uniqueList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

function splitPdfTitleAndNote(value) {
  const text = normalizePdfTitle(value)
  if (!text) return { title: '', notes: '' }

  const separatorMatch = text.match(/\s+(?:--?|\u2014|\u2013)\s+|\t+|\s{3,}/)
  if (separatorMatch?.index > 0) {
    const title = text.slice(0, separatorMatch.index).trim()
    const notes = text.slice(separatorMatch.index + separatorMatch[0].length).trim()
    if (title && notes) return { title, notes }
  }

  const parentheticalMatch = text.match(/^(.*?)\s*\(([^)]{3,80})\)\s*$/)
  if (parentheticalMatch) {
    const note = parentheticalMatch[2].trim()
    if (/\b(maybe|note|with|watch|rewatch|later|soon|friend|family|favorite|fav|skip|priority|rec|recommended)\b/i.test(note)) {
      return { title: parentheticalMatch[1].trim(), notes: note }
    }
  }

  return { title: text, notes: '' }
}

function expandImportedCollections(items) {
  const expanded = []

  for (const item of items) {
    const collection = findKnownCollection(item.title)
    if (!collection) {
      expanded.push(item)
      continue
    }

    const sourceTitle = String(item.title || '')
    const titles = selectedCollectionTitles(sourceTitle, collection)
    const tags = Array.isArray(item.tags) ? item.tags : []
    const priority = Number(item.priority) || 80

    titles.forEach((title, index) => {
      expanded.push({
        ...item,
        title,
        type: 'movie',
        priority: Math.max(1, priority - index),
        tags: uniqueList([...tags, collection.label, 'Collection']),
        notes: uniqueList([item.notes || '', `Expanded from ${sourceTitle}`].map(String)).join(' / '),
      })
    })
  }

  return expanded
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
  } finally {
    await parser.destroy()
  }
}

function normalizePdfTitle(title) {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .replace(/^\d+[).:-]\s*/, '')
    .trim()
}

function titleDistance(left, right) {
  const a = String(left || '').toLowerCase()
  const b = String(right || '').toLowerCase()
  const distances = Array.from({ length: a.length + 1 }, (_, index) => [index])
  for (let index = 1; index <= b.length; index += 1) distances[0][index] = index
  for (let row = 1; row <= a.length; row += 1) {
    for (let col = 1; col <= b.length; col += 1) {
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + (a[row - 1] === b[col - 1] ? 0 : 1),
      )
    }
  }
  return distances[a.length][b.length]
}

function shouldUseCorrectedTitle(original, corrected) {
  if (!corrected || corrected.length < 2) return false
  const cleanOriginal = normalizePdfTitle(original)
  const cleanCorrected = normalizePdfTitle(corrected)
  if (!cleanOriginal || cleanOriginal.toLowerCase() === cleanCorrected.toLowerCase()) return false
  const maxLength = Math.max(cleanOriginal.length, cleanCorrected.length)
  return titleDistance(cleanOriginal, cleanCorrected) <= Math.max(2, Math.ceil(maxLength * 0.22))
}

function parseWatchlistLines(text) {
  let status = 'Want to Watch'
  let priority = 1000
  const items = []
  const seen = new Set()

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue
    if (/^PLANNING TO WATCH/i.test(line)) {
      status = 'Want to Watch'
      continue
    }
    if (/^WANT TO REWATCH/i.test(line)) {
      status = 'Want to Rewatch'
      continue
    }
    if (/^HAVE WATCHED/i.test(line)) {
      status = 'Watched'
      continue
    }

    const startsWithBullet = line.charCodeAt(0) === 9679 || line.startsWith('- ') || line.startsWith('* ')
    if (!startsWithBullet) continue

    const { title, notes } = splitPdfTitleAndNote(line.slice(1))
    if (!title) continue
    const key = `${title.toLowerCase()}|${status}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push({
      title,
      type: 'custom',
      status,
      priority: priority--,
      tags: ['PDF import'],
      notes,
    })
  }

  return items
}

function normalizeImportedStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value.includes('rewatch')) return 'Want to Rewatch'
  if (value.includes('watch') && value.includes('want')) return 'Want to Watch'
  if (value.includes('watched') || value.includes('complete') || value.includes('done')) return 'Watched'
  return 'Want to Watch'
}

function normalizeImportedType(type) {
  const value = String(type || '').toLowerCase()
  if (value.includes('anime')) return 'anime'
  if (value.includes('tv') || value.includes('show') || value.includes('series')) return 'show'
  if (value.includes('movie') || value.includes('film')) return 'movie'
  return 'custom'
}

function existingMediaKey(item) {
  return mediaIdentityKey(item)
}

async function correctImportedTitles(items) {
  const chunks = []
  for (let index = 0; index < items.length; index += 80) {
    chunks.push(items.slice(index, index + 80))
  }

  const corrections = new Map()
  for (const chunk of chunks) {
    const prompt = `
Return JSON only. Correct obvious spelling typos in media titles.
Schema: [{"originalTitle":"string","correctedTitle":"string"}]
Rules:
- Return one object for every input title, in the same order.
- Only fix spelling/spacing/capitalization typos for known movies, shows, or anime.
- Preserve season/franchise wording when it is meaningful.
- Do not invent new titles. If unsure, keep correctedTitle identical to originalTitle.
Titles:
${chunk.map((item, index) => `${index + 1}. ${item.title}`).join('\n')}
    `.trim()

    try {
      const interpreted = await geminiJsonArray(prompt, 'pdf-title-correction', 3000)
      interpreted.items.forEach((item) => {
        if (item.originalTitle && item.correctedTitle) {
          corrections.set(String(item.originalTitle).toLowerCase(), item.correctedTitle)
        }
      })
    } catch {
      // Title correction is a quality pass; importing the raw PDF is still better than failing.
    }
  }

  return items.map((item) => {
    const knownCorrection = applyKnownTitleCorrection(item.title)
    if (knownCorrection !== item.title) {
      return { ...item, originalTitle: item.title, title: knownCorrection }
    }

    const correctedTitle = corrections.get(item.title.toLowerCase())
    return shouldUseCorrectedTitle(item.title, correctedTitle)
      ? { ...item, originalTitle: item.title, title: normalizePdfTitle(correctedTitle) }
      : item
  })
}

function buildPdfImportPrompt(text, fallbackItems) {
  const fallbackList = fallbackItems
    .slice(0, 120)
    .map((item, index) => `${index + 1}. ${item.title}${item.notes ? ` [note: ${item.notes}]` : ''}`)
    .join('\n')

  return `
Return JSON only. Extract a watchlist from this PDF text.
Schema: [{"title":"string","type":"movie|show|anime|custom","status":"Watched|Want to Watch|Want to Rewatch","priority":1-100,"tags":["string"],"notes":"string"}]
Rules:
- Include only real media titles, not headings, page numbers, dates, instructions, ratings, or layout labels.
- If a media title has side text next to it, after it, in a margin, or after separators like "-", "--", em dash, tabs, or wide spacing, keep only the media name in "title" and put the side text in "notes".
- Do not include personal notes, comments, reminders, dates, "watch with...", "maybe", "recommended by...", or priority text inside "title".
- Infer type and status when possible. Default status is "Want to Watch".
- Use higher priority for titles that appear ranked, starred, highlighted, or near the top.
- When the PDF says an entire trilogy, saga, series, universe, collection, or franchise should be watched, expand it into the individual well-known movies/shows when you are confident. Return one JSON object per installment so the app creates separate poster icons/cards.
- For expanded collections, add a shared tag like "Lord of the Rings collection" or "Star Wars franchise". Keep notes short, such as "Expanded from trilogy request".
- If a franchise request is too broad or ambiguous to expand confidently, return a single custom item named like "Alien franchise" with tags ["Collection"] and explain the ambiguity in notes.
- Preserve subtitles that are part of the real title, such as "Mission: Impossible" or "Spider-Man: Into the Spider-Verse".
- Return every media title you can identify.
Examples:
- "Pacific Rim: The Black    watch after season 1" => {"title":"Pacific Rim: The Black","type":"show","status":"Want to Watch","priority":80,"tags":[],"notes":"watch after season 1"}
- "The Dark Knight trilogy" => return "Batman Begins", "The Dark Knight", and "The Dark Knight Rises" as separate movie objects tagged "The Dark Knight trilogy".
- "all Hunger Games movies" => return the individual Hunger Games films as separate movie objects tagged "Hunger Games collection".
Simple parser candidates, if useful:
${fallbackList || 'none'}
PDF text:
${text.slice(0, 18000)}
  `.trim()
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function importWatchlistFromPdf(buffer) {
  const text = await extractPdfText(buffer)
  if (!text || text.length < 3) {
    throw new Error('Could not extract readable text from that PDF.')
  }

  const fallbackItems = parseWatchlistLines(text)
  let interpreted = {
    model: 'deterministic-pdf-parser',
    fallbackCount: 0,
    attemptedModels: [],
    items: fallbackItems,
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const aiInterpreted = await geminiJsonArray(buildPdfImportPrompt(text, fallbackItems), 'pdf-watchlist-import', 5000)
      if (aiInterpreted.items.length > 0) {
        interpreted = aiInterpreted
      }
    } catch (error) {
      if (fallbackItems.length === 0) throw error
    }
  }

  interpreted.items = expandImportedCollections(await correctImportedTitles(interpreted.items))

  const existingKeys = new Set(mediaRows().map(existingMediaKey))
  const skipped = []
  const candidates = []

  for (const [index, rawItem] of interpreted.items.entries()) {
    const parsedTitle = splitPdfTitleAndNote(rawItem.title)
    const titleParts = splitTrailingReleaseYear(parsedTitle.title)
    const title = titleParts.title
    if (!title) continue
    const notes = uniqueList([rawItem.notes || '', parsedTitle.notes].map(String)).join(' / ')

    const type = normalizeImportedType(rawItem.type)
    const status = normalizeImportedStatus(rawItem.status)
    const key = existingMediaKey({ title, type, status })
    if (existingKeys.has(key)) {
      skipped.push({ title, type, status, reason: 'Already exists' })
      continue
    }
    existingKeys.add(key)
    candidates.push({ rawItem: { ...rawItem, notes }, title, preferredYear: titleParts.year, type, status, index })
  }

  const enriched = await mapWithConcurrency(candidates, 5, async (candidate) => ({
    ...candidate,
    tmdb: await findBestTmdb(candidate.title.replace(/\s*\([^)]*\)\s*$/, ''), candidate.type, candidate.preferredYear),
  }))

  const created = []
  for (const candidate of enriched) {
    const { rawItem, title, type, status, index, tmdb } = candidate
    const tags = Array.isArray(rawItem.tags) ? rawItem.tags.filter(Boolean) : []
    const savedTitle = candidate.preferredYear && tmdb?.release_year === candidate.preferredYear ? tmdb.title : title
    const saved = insertMedia({
      ...(tmdb || {}),
      title: savedTitle,
      type: type === 'anime' ? 'anime' : tmdb?.type || type,
      status,
      priority: Number(rawItem.priority) || interpreted.items.length - index,
      tags: uniqueList([...(tmdb?.tags || []), ...tags, 'PDF import']),
      genres: tmdb?.genres || tags,
      description: tmdb?.description || rawItem.notes || 'Imported from a PDF watchlist.',
    })
    created.push({ ...saved, importNote: rawItem.notes || '', sourceModel: rawItem.sourceModel || interpreted.model })
  }

  return {
    model: interpreted.model,
    fallbackCount: interpreted.fallbackCount,
    attemptedModels: interpreted.attemptedModels,
    extractedCharacters: text.length,
    extractedItems: interpreted.items.length,
    created,
    skipped,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    tmdbConfigured: Boolean(tmdbKey || tmdbToken),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    geminiFallbacks: geminiModelQueue(),
  })
})

app.get('/api/media', (_req, res) => {
  normalizeExistingLibrary()
  res.json(mediaRows())
})

app.post('/api/media', (req, res) => {
  try {
    const saved = insertMedia(req.body)
    res.status(saved.duplicate ? 200 : 201).json(saved)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.patch('/api/media/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Media not found' })

  const merged = bindMediaPayload({ ...rowToMedia(existing), ...req.body })
  if (merged.status === 'Watched' && !existing.completed_at) {
    merged.completed_at = new Date().toISOString()
  }
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
})

app.delete('/api/media/:id', (req, res) => {
  db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

app.get('/api/search/tmdb', async (req, res) => {
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

app.post('/api/recommendations', async (req, res) => {
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

app.post('/api/import/pdf', upload.single('watchlist'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Attach a PDF file named watchlist.' })
    }
    res.json(await importWatchlistFromPdf(req.file.buffer))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/backup/export', (_req, res) => {
  res.json({
    schema: backupSchema,
    exported_at: new Date().toISOString(),
    media: mediaRows(),
    settings: settingsObject(db, parseJson),
  })
})

app.post('/api/backup/preview', (req, res) => {
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

app.post('/api/backup/restore', (req, res) => {
  try {
    if (req.body?.mode !== 'merge') {
      return res.status(400).json({ error: 'Only merge restore mode is supported' })
    }

    const plan = backupMediaPlan(req.body.backup, { mediaRows, mediaIdentityKey, findExistingMedia })
    const created = []
    const skipped = [...plan.duplicates]

    for (const item of plan.create) {
      const saved = insertMedia(item)
      if (saved.duplicate) {
        skipped.push(backupDuplicateSummary(saved))
      } else {
        created.push(saved)
      }
    }

    if (plan.settings) {
      const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      Object.entries(plan.settings).forEach(([key, value]) => upsert.run(key, JSON.stringify(value)))
    }

    res.json({
      ok: true,
      created,
      skipped,
      invalid: plan.invalid,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.get('/api/stats', (_req, res) => {
  const items = mediaRows()
  const watched = items.filter((item) => item.status === 'Watched')
  const byType = watched.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {})
  const genreCounts = {}
  const monthly = {}
  watched.forEach((item) => {
    item.genres.forEach((genre) => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1
    })
    if (item.completed_at) {
      const key = item.completed_at.slice(0, 7)
      monthly[key] = (monthly[key] || 0) + 1
    }
  })
  const ratings = watched.map((item) => item.personal_rating).filter(Boolean)
  const hours = Math.round((watched.reduce((sum, item) => sum + (item.runtime || 45), 0) / 60) * 10) / 10

  res.json({
    total: items.length,
    watched: watched.length,
    byType,
    hours,
    favoriteGenres: Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
    completionRate: items.length ? Math.round((watched.length / items.length) * 100) : 0,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0,
    monthly: Object.entries(monthly).sort().map(([month, count]) => ({ month, count })),
    yearReview: watched
      .filter((item) => item.completed_at?.startsWith(String(new Date().getFullYear())))
      .sort((a, b) => (b.personal_rating || 0) - (a.personal_rating || 0))
      .slice(0, 5),
  })
})

app.get('/api/settings', (_req, res) => {
  res.json({
    api: {
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      tmdbConfigured: Boolean(tmdbKey || tmdbToken),
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      geminiFallbacks: geminiModelQueue(),
    },
    preferences: settingsObject(db, parseJson),
  })
})

app.post('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
  Object.entries(req.body || {}).forEach(([key, value]) => upsert.run(key, JSON.stringify(value)))
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`MediaTracker API listening on http://localhost:${PORT}`)
})
