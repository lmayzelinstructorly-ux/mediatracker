function normalizeLookupTitle(title) {
  return String(title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function mediaTypeCandidates(type) {
  const normalized = type || 'movie'
  return normalized === 'show' || normalized === 'anime'
    ? ['show', 'anime']
    : [normalized]
}

function typePlaceholders(types) {
  return types.map(() => '?').join(', ')
}

function findExistingMediaInDatabase(db, payload, mapRow = (row) => row) {
  const titleKey = normalizeLookupTitle(payload.title)
  if (!titleKey) return null

  const types = mediaTypeCandidates(payload.type)
  const placeholders = typePlaceholders(types)
  let row = null

  if (payload.tmdb_id != null) {
    row = db.prepare(`
      SELECT * FROM media
      WHERE tmdb_id = ?
        AND type IN (${placeholders})
      ORDER BY CASE WHEN type = ? THEN 0 ELSE 1 END, updated_at DESC
      LIMIT 1
    `).get(Number(payload.tmdb_id), ...types, payload.type || 'movie')
  }

  if (!row) {
    const releaseYear = String(payload.release_year || '')
    row = db.prepare(`
      SELECT * FROM media
      WHERE lower(trim(title)) = ?
        AND type IN (${placeholders})
        AND (? = '' OR COALESCE(release_year, '') = '' OR release_year = ?)
      ORDER BY
        CASE
          WHEN release_year = ? THEN 0
          WHEN COALESCE(release_year, '') = '' THEN 1
          ELSE 2
        END,
        CASE WHEN type = ? THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1
    `).get(titleKey, ...types, releaseYear, releaseYear, releaseYear, payload.type || 'movie')
  }

  return row ? mapRow(row) : null
}

export {
  findExistingMediaInDatabase,
  mediaTypeCandidates,
  normalizeLookupTitle,
}
