import { PDFParse } from 'pdf-parse'

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
          priority: Math.max(1, priority - index),
          tags: uniqueList([...tags, collection.label, 'Collection']),
          notes: uniqueList([item.notes || '', `Expanded from ${sourceTitle}`].map(String)).join(' / '),
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

  return {
    importWatchlistFromPdf,
  }
}
