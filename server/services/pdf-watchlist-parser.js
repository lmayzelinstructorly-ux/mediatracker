const statusHeadings = [
  { status: 'Want to Rewatch', pattern: /^(?:want to rewatch|rewatch(?:list)?|to rewatch)$/i },
  { status: 'Watched', pattern: /^(?:have watched|already watched|watched|completed|finished|done)$/i },
  { status: 'Want to Watch', pattern: /^(?:planning to watch|plan to watch|want to watch|to watch|watchlist|movies? to watch|shows? to watch|anime to watch)$/i },
]

function uniqueList(items) {
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))]
}

function normalizeEvidence(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeImportedStatus(value, fallback = 'Want to Watch') {
  const text = String(value || '').toLowerCase()
  if (/\b(?:rewatch|watch again)\b/.test(text)) return 'Want to Rewatch'
  if (/\b(?:watched|completed|complete|finished|done)\b/.test(text) && !/\b(?:not|un)watched\b/.test(text)) return 'Watched'
  if (/\b(?:want to watch|to watch|watchlist|planning to watch|plan to watch)\b/.test(text)) return 'Want to Watch'
  return fallback
}

function normalizeImportedType(value, fallback = 'custom') {
  const text = String(value || '').toLowerCase()
  if (/\banime\b/.test(text)) return 'anime'
  if (/\b(?:tv|show|series|season)\b/.test(text)) return 'show'
  if (/\b(?:movie|film)\b/.test(text)) return 'movie'
  return fallback
}

function headingStatus(line) {
  const normalized = String(line || '')
    .trim()
    .replace(/^[#=_\-–—\s]+|[#=_\-–—:\s]+$/g, '')
  return statusHeadings.find(({ pattern }) => pattern.test(normalized))?.status || null
}

function stripListMarker(line) {
  let text = String(line || '').trim()
  let starred = false
  const starMatch = text.match(/^[★⭐]\s*/u)
  if (starMatch) {
    starred = true
    text = text.slice(starMatch[0].length)
  }

  const numbered = text.match(/^(\d{1,3})[.)]\s+/)
  if (numbered) {
    return { text: text.slice(numbered[0].length), listed: true, rank: Number(numbered[1]), starred }
  }

  const marker = text.match(/^(?:[A-Za-z][.)]|[-*+•●▪◦‣∙]|\[\s*(?:x|X|✓| )?\s*\]|☐|☑|✓|✔)\s+/u)
  if (marker) return { text: text.slice(marker[0].length), listed: true, rank: null, starred }
  return { text, listed: false, rank: null, starred }
}

function isMetadataToken(value) {
  const token = String(value || '').trim()
  return /^(?:19\d{2}|20\d{2})$/.test(token) ||
    /^(?:movie|film|tv|show|series|anime|watched|completed|finished|done|rewatch|want to watch|to watch)$/i.test(token) ||
    /\b(?:recommended|watch with|watch after|watch before|later|soon|priority|favorite|favourite|rating|maybe)\b/i.test(token)
}

function splitPdfTitleAndNote(value) {
  let source = String(value || '').replace(/\r/g, '').trim()
  if (!source) return { title: '', notes: '', type: 'custom', status: null, release_year: '' }

  const metadata = []
  const columns = source.split(/\s*\|\s*|\t+/).map((part) => part.trim()).filter(Boolean)
  if (columns.length > 1) {
    source = columns.shift()
    metadata.push(...columns)
  }

  const separator = source.match(/\s+(?:--|—|–)\s+|\s+-\s+(?=(?:watch|rewatch|watched|movie|film|show|tv|series|anime|recommended|with|after|before|later|soon|priority|rating|favorite|favourite)\b)/i)
  if (separator?.index > 0) {
    metadata.unshift(source.slice(separator.index + separator[0].length).trim())
    source = source.slice(0, separator.index).trim()
  }

  source = source.replace(/\s*[[(]([^\])]+)[\])]\s*/g, (match, token) => {
    if (!isMetadataToken(token)) return match
    metadata.push(token.trim())
    return ' '
  })

  const rating = source.match(/\s+((?:\d(?:\.\d)?|10)\s*\/\s*10)\s*$/i)
  if (rating) {
    metadata.push(`rating ${rating[1]}`)
    source = source.slice(0, rating.index).trim()
  }

  const metadataText = metadata.join(' / ')
  const releaseYear = metadataText.match(/\b(19\d{2}|20\d{2})\b/)?.[1] || ''
  const detectedStatus = normalizeImportedStatus(metadataText, null)
  const detectedType = normalizeImportedType(metadataText, 'custom')
  const notes = metadata.filter((part) => !/^(?:19\d{2}|20\d{2}|movie|film|tv|show|series|anime|watched|completed|finished|done|rewatch|want to watch|to watch)$/i.test(part.trim()))

  const title = source
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title,
    notes: uniqueList(notes).join(' / '),
    type: detectedType,
    status: detectedStatus,
    release_year: releaseYear,
  }
}

function isNoiseLine(line) {
  const text = String(line || '').trim()
  if (!text) return true
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(text)) return true
  if (/^(?:page\s*)?\d+(?:\s*(?:\/|of)\s*\d+)?$/i.test(text)) return true
  if (/^(?:https?:\/\/|www\.)/i.test(text) || /\S+@\S+\.\S+/.test(text)) return true
  if (/^(?:generated|exported|created|updated)\s+(?:on|at)\b/i.test(text)) return true
  if (/^(?:19\d{2}|20\d{2})[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])$/.test(text)) return true

  const words = normalizeEvidence(text).split(' ').filter(Boolean)
  const headerWords = new Set(['title', 'name', 'year', 'type', 'status', 'rating', 'priority', 'notes', 'note'])
  if (words.length > 0 && words.every((word) => headerWords.has(word))) return true
  return false
}

function parseWatchlistLines(text) {
  let currentStatus = 'Want to Watch'
  let sectionActive = false
  let priority = 1000
  const items = []
  const seen = new Set()

  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.trim()
    const status = headingStatus(line)
    if (status) {
      currentStatus = status
      sectionActive = true
      continue
    }

    const marker = stripListMarker(line)
    if (!marker.listed && !sectionActive) continue
    if (isNoiseLine(marker.text)) continue
    if (!marker.listed) {
      const wordCount = normalizeEvidence(marker.text).split(' ').filter(Boolean).length
      if (marker.text.length > 140 || wordCount > 18 || /[.!?]$/.test(marker.text)) continue
    }

    const parsed = splitPdfTitleAndNote(marker.text)
    if (!parsed.title || parsed.title.length > 300) continue
    const itemStatus = parsed.status || currentStatus
    const itemType = parsed.type || 'custom'
    const key = [normalizeEvidence(parsed.title), itemType, itemStatus, parsed.release_year].join('|')
    if (!normalizeEvidence(parsed.title) || seen.has(key)) continue
    seen.add(key)

    const rankedPriority = marker.rank ? Math.max(1, 1001 - marker.rank) : priority--
    items.push({
      title: parsed.title,
      type: itemType,
      status: itemStatus,
      release_year: parsed.release_year,
      priority: rankedPriority + (marker.starred ? 100 : 0),
      tags: ['PDF import'],
      notes: parsed.notes,
    })
  }

  return items
}

function itemSimilarity(left, right) {
  const leftTokens = new Set(normalizeEvidence(left).split(' ').filter(Boolean))
  const rightTokens = new Set(normalizeEvidence(right).split(' ').filter(Boolean))
  if (!leftTokens.size || !rightTokens.size) return 0
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return (2 * intersection) / (leftTokens.size + rightTokens.size)
}

function mergeExtractedItems({ text, aiItems = [], fallbackItems = [] }) {
  const normalizedText = normalizeEvidence(text)
  const fallback = fallbackItems.filter((item) => item?.title)
  const usedFallback = new Set()
  const merged = []

  for (const aiItem of aiItems.filter((item) => item?.title)) {
    const aiTitle = String(aiItem.title).trim()
    const evidenceKey = normalizeEvidence(aiTitle)
    const closest = fallback
      .map((item, index) => ({ index, similarity: itemSimilarity(aiTitle, item.title) }))
      .sort((left, right) => right.similarity - left.similarity)[0]
    const groundedByFallback = closest?.similarity >= 0.72
    const groundedByText = evidenceKey.length >= 3 && normalizedText.includes(evidenceKey)
    if (!groundedByFallback && !groundedByText) continue

    const fallbackItem = groundedByFallback ? fallback[closest.index] : null
    if (fallbackItem) usedFallback.add(closest.index)
    merged.push({
      ...fallbackItem,
      ...aiItem,
      title: aiTitle,
      type: normalizeImportedType(aiItem.type, fallbackItem?.type || 'custom'),
      status: fallbackItem?.status || normalizeImportedStatus(aiItem.status),
      release_year: String(aiItem.release_year || fallbackItem?.release_year || ''),
      priority: Math.max(Number(aiItem.priority) || 0, Number(fallbackItem?.priority) || 0),
      tags: uniqueList([...(fallbackItem?.tags || []), ...(Array.isArray(aiItem.tags) ? aiItem.tags : [])]),
      notes: uniqueList([fallbackItem?.notes, aiItem.notes]).join(' / '),
    })
  }

  fallback.forEach((item, index) => {
    if (!usedFallback.has(index)) merged.push(item)
  })

  const seen = new Set()
  return merged.filter((item) => {
    const key = [normalizeEvidence(item.title), item.type || 'custom', item.status || 'Want to Watch', item.release_year || ''].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export {
  mergeExtractedItems,
  normalizeImportedStatus,
  normalizeImportedType,
  parseWatchlistLines,
  splitPdfTitleAndNote,
}
