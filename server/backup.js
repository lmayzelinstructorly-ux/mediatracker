export const backupSchema = 'framelog.backup.v1'

export function settingsObject(db, parseJson) {
  return Object.fromEntries(
    db.prepare('SELECT * FROM settings').all().map((row) => [row.key, parseJson(row.value, row.value)]),
  )
}

export function normalizeBackupList(value) {
  return Array.isArray(value) ? value.filter((item) => item != null && item !== '') : []
}

export function normalizeBackupMediaItem(rawItem) {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    return {
      item: { title: '', type: 'movie', status: 'Want to Watch' },
      invalid: { title: '', reason: 'Media item must be an object' },
    }
  }

  const title = String(rawItem.title || '').trim()
  const item = {
    tmdb_id: rawItem.tmdb_id ?? null,
    title,
    type: rawItem.type || 'movie',
    cover_art: rawItem.cover_art || '',
    genres: normalizeBackupList(rawItem.genres),
    tags: normalizeBackupList(rawItem.tags),
    description: rawItem.description || '',
    runtime: Number(rawItem.runtime) || 0,
    release_year: rawItem.release_year ? String(rawItem.release_year) : '',
    tmdb_rating: rawItem.tmdb_rating ?? null,
    status: rawItem.status || 'Want to Watch',
    priority: Number(rawItem.priority) || 0,
    personal_rating: rawItem.personal_rating ?? null,
    reflection: rawItem.reflection || '',
    season: Number(rawItem.season) || 1,
    episode: Number(rawItem.episode) || 0,
    completed_at: rawItem.completed_at || null,
    reminder_at: rawItem.reminder_at || null,
  }

  return {
    item,
    invalid: title ? null : { title, reason: 'Title is required' },
  }
}

export function parseBackupPayload(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('Backup must be a JSON object')
  }
  if (backup.schema !== backupSchema) {
    throw new Error(`Backup schema must be ${backupSchema}`)
  }
  if (!Array.isArray(backup.media)) {
    throw new Error('Backup media must be an array')
  }
  if (
    backup.settings !== undefined
    && (!backup.settings || typeof backup.settings !== 'object' || Array.isArray(backup.settings))
  ) {
    throw new Error('Backup settings must be an object')
  }
  return backup
}

export function backupDuplicateSummary(item) {
  return {
    title: item.title,
    type: item.type || 'movie',
    status: item.status || 'Want to Watch',
  }
}

export function backupMediaPlan(backup, { mediaRows, mediaIdentityKey, findExistingMedia }) {
  const parsed = parseBackupPayload(backup)
  const existingKeys = new Set(mediaRows().map(mediaIdentityKey))
  const createKeys = new Set()
  const create = []
  const duplicates = []
  const invalid = []

  for (const rawItem of parsed.media) {
    const { item, invalid: invalidItem } = normalizeBackupMediaItem(rawItem)
    if (invalidItem) {
      invalid.push(invalidItem)
      continue
    }

    const key = mediaIdentityKey(item)
    if (existingKeys.has(key) || createKeys.has(key) || findExistingMedia(item)) {
      duplicates.push(backupDuplicateSummary(item))
      continue
    }

    createKeys.add(key)
    create.push(item)
  }

  return {
    total: parsed.media.length,
    create,
    duplicates,
    invalid,
    settings: parsed.settings,
  }
}
