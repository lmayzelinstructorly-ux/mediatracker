import { db } from './db.js'
import {
  applyKnownTitleCorrection,
  findKnownCollection,
  knownCollectionForTitle,
  knownCollectionTitle,
  selectedCollectionTitles,
  titleMatchKey,
} from './known-media.js'

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

function uniqueList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
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

export {
  bindMediaPayload,
  findExistingMedia,
  insertMedia,
  librarySnapshot,
  mediaIdentityKey,
  mediaRows,
  normalizeExistingLibrary,
  parseJson,
  rowToMedia,
  splitTrailingReleaseYear,
}
