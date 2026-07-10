import { PDFParse } from 'pdf-parse'
import {
  mergeExtractedItems,
  normalizeImportedStatus,
  normalizeImportedType,
  parseWatchlistLines,
  splitPdfTitleAndNote,
} from './pdf-watchlist-parser.js'

function uniqueList(items) {
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))]
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

function buildPdfImportPrompt(text, fallbackItems) {
  const fallbackList = fallbackItems
    .slice(0, 120)
    .map((item, index) => `${index + 1}. ${item.title}${item.release_year ? ` (${item.release_year})` : ''}${item.notes ? ` [note: ${item.notes}]` : ''}`)
    .join('\n')

  return `
Return JSON only. Extract a watchlist from this PDF text.
Schema: [{"title":"string","type":"movie|show|anime|custom","status":"Watched|Want to Watch|Want to Rewatch","release_year":"YYYY or blank","priority":1-100,"tags":["string"],"notes":"string"}]
Rules:
- Include only real media titles, not headings, page numbers, dates, instructions, ratings, or layout labels.
- Every title must be grounded in the PDF text, except individual installments expanded from an explicitly named collection.
- Treat nearby year, type, and status labels as metadata. Put years in release_year instead of title.
- If a media title has side text next to it, after it, in a margin, or after separators, keep only the media name in title and put the side text in notes.
- Do not include personal notes, comments, reminders, dates, watch-with notes, recommendations, or priority text inside title.
- Infer type and status only from evidence in the PDF. Keep type custom when movie versus show is unclear. Default status is Want to Watch.
- Do not choose a similarly named title, sequel, remake, movie, or show just because it is popular. Preserve the PDF wording when uncertain.
- Use higher priority for titles that appear ranked, starred, highlighted, or near the top.
- When the PDF explicitly requests an entire trilogy, saga, series, universe, collection, or franchise, expand it only when the installments are well known and unambiguous.
- For expanded collections, add one shared collection tag and a short expansion note.
- If a franchise request is broad or ambiguous, return one custom collection item instead of guessing installments.
- Preserve subtitles that are part of the real title, such as Mission: Impossible or Spider-Man: Into the Spider-Verse.
- Return every supported media title you can identify.
Examples:
- "Pacific Rim: The Black    watch after season 1" => {"title":"Pacific Rim: The Black","type":"show","status":"Want to Watch","release_year":"","priority":80,"tags":[],"notes":"watch after season 1"}
- "Arrival | Movie | 2016" => {"title":"Arrival","type":"movie","status":"Want to Watch","release_year":"2016","priority":80,"tags":[],"notes":""}
- "The Dark Knight trilogy" => return Batman Begins, The Dark Knight, and The Dark Knight Rises as separate movie objects tagged The Dark Knight trilogy.
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

export function createPdfImportService({
  mediaRows,
  mediaIdentityKey,
  insertMedia,
  findBestTmdb,
  geminiJsonArray,
  applyKnownTitleCorrection,
  findKnownCollection,
  selectedCollectionTitles,
  splitTrailingReleaseYear,
}) {
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
          release_year: '',
          priority: Math.max(1, priority - index),
          tags: uniqueList([...tags, collection.label, 'Collection']),
          notes: uniqueList([item.notes, `Expanded from ${sourceTitle}`]).join(' / '),
        })
      })
    }

    return expanded
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
- Only fix spelling, spacing, or capitalization typos for known movies, shows, or anime.
- Preserve season, year, subtitle, and franchise wording when meaningful.
- Never switch to a different franchise, sequel, remake, movie, or show.
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
        // Title correction is optional; importing grounded raw titles is safer than failing.
      }
    }

    return items.map((item) => {
      const knownCorrection = applyKnownTitleCorrection(item.title)
      if (knownCorrection !== item.title) {
        return { ...item, originalTitle: item.title, title: knownCorrection }
      }

      const correctedTitle = corrections.get(String(item.title).toLowerCase())
      return shouldUseCorrectedTitle(item.title, correctedTitle)
        ? { ...item, originalTitle: item.title, title: normalizePdfTitle(correctedTitle) }
        : item
    })
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
          interpreted = {
            ...aiInterpreted,
            items: mergeExtractedItems({
              text,
              aiItems: aiInterpreted.items,
              fallbackItems,
            }),
          }
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

      const notes = uniqueList([rawItem.notes, parsedTitle.notes]).join(' / ')
      const type = normalizeImportedType([rawItem.type, parsedTitle.type, notes].filter(Boolean).join(' '))
      const status = normalizeImportedStatus([rawItem.status, parsedTitle.status, notes].filter(Boolean).join(' '))
      const preferredYear = String(rawItem.release_year || parsedTitle.release_year || titleParts.year || '')
      const key = existingMediaKey({ title, type, release_year: preferredYear, status })
      if (existingKeys.has(key)) {
        skipped.push({ title, type, status, reason: 'Already exists' })
        continue
      }

      existingKeys.add(key)
      candidates.push({
        rawItem: { ...rawItem, notes },
        title,
        preferredYear,
        type,
        status,
        index,
      })
    }

    const enriched = await mapWithConcurrency(candidates, 5, async (candidate) => ({
      ...candidate,
      tmdb: await findBestTmdb(candidate.title, candidate.type, candidate.preferredYear),
    }))

    const created = []
    for (const candidate of enriched) {
      const { rawItem, title, type, status, index, tmdb } = candidate
      const tags = Array.isArray(rawItem.tags) ? rawItem.tags.filter(Boolean) : []
      const savedTitle = tmdb?.title || title
      const saved = insertMedia({
        ...(tmdb || {}),
        title: savedTitle,
        type: type === 'anime' ? 'anime' : tmdb?.type || type,
        status,
        priority: Number(rawItem.priority) || interpreted.items.length - index,
        tags: uniqueList([...(tmdb?.tags || []), ...tags, 'PDF import', tmdb ? '' : 'Needs review']),
        genres: tmdb?.genres || [],
        description: tmdb?.description || rawItem.notes || 'Imported from a PDF watchlist.',
        release_year: tmdb?.release_year || candidate.preferredYear,
      })
      created.push({
        ...saved,
        importNote: rawItem.notes || '',
        sourceModel: rawItem.sourceModel || interpreted.model,
        matchedTmdb: Boolean(tmdb),
      })
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

  return {
    importWatchlistFromPdf,
  }
}
