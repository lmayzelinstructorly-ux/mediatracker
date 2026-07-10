const mediaTypes = ['movie', 'show', 'anime', 'custom']
const mediaStatuses = ['Watched', 'Want to Watch', 'Want to Rewatch']

function fail(message) {
  throw new Error(message)
}

function optionalString(value, field) {
  if (value == null) return ''
  if (typeof value !== 'string') fail(`${field} must be a string`)
  return value.trim()
}

function stringList(value, field, fallback = []) {
  if (value == null) return [...fallback]
  if (!Array.isArray(value)) fail(`${field} must be an array of strings`)
  return [...new Set(value.map((item) => {
    if (typeof item !== 'string') fail(`${field} must contain only strings`)
    return item.trim()
  }).filter(Boolean))]
}

function integer(value, field, { defaultValue, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value == null || value === '') return defaultValue
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${field} must be an integer between ${min} and ${max}`)
  }
  return number
}

function number(value, field, { defaultValue, min = -Infinity, max = Infinity } = {}) {
  if (value == null || value === '') return defaultValue
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    fail(`${field} must be a number between ${min} and ${max}`)
  }
  return parsed
}

function isoDate(value, field) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    fail(`${field} must be a valid date`)
  }
  return new Date(value).toISOString()
}

function releaseYear(value) {
  if (value == null || value === '') return ''
  const year = Number(value)
  const latestYear = new Date().getFullYear() + 10
  if (!Number.isInteger(year) || year < 1878 || year > latestYear) {
    fail(`release_year must be a year between 1878 and ${latestYear}`)
  }
  return String(year)
}

function enumValue(value, field, allowed, defaultValue) {
  const resolved = value == null ? defaultValue : value
  if (!allowed.includes(resolved)) fail(`${field} must be one of: ${allowed.join(', ')}`)
  return resolved
}

function normalizeMediaPayload(payload, { now = () => new Date().toISOString() } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('Media payload must be an object')
  }

  const title = optionalString(payload.title, 'title')
  if (!title) fail('Title is required')
  if (title.length > 300) fail('title must be 300 characters or fewer')

  const type = enumValue(payload.type, 'type', mediaTypes, 'movie')
  const status = enumValue(payload.status, 'status', mediaStatuses, 'Want to Watch')
  const genres = stringList(payload.genres, 'genres')
  const tags = stringList(payload.tags, 'tags', genres)
  const completedAt = status === 'Watched'
    ? isoDate(payload.completed_at || now(), 'completed_at')
    : null

  return {
    tmdb_id: integer(payload.tmdb_id, 'tmdb_id', { defaultValue: null, min: 1 }),
    title,
    type,
    cover_art: optionalString(payload.cover_art, 'cover_art'),
    genres,
    tags,
    description: optionalString(payload.description, 'description'),
    runtime: integer(payload.runtime, 'runtime', { defaultValue: 0, min: 0, max: 100000 }),
    release_year: releaseYear(payload.release_year),
    tmdb_rating: number(payload.tmdb_rating, 'tmdb_rating', { defaultValue: null, min: 0, max: 10 }),
    status,
    priority: integer(payload.priority, 'priority', { defaultValue: 0, min: 0 }),
    personal_rating: number(payload.personal_rating, 'personal_rating', { defaultValue: null, min: 1, max: 10 }),
    reflection: optionalString(payload.reflection, 'reflection'),
    season: integer(payload.season, 'season', { defaultValue: 1, min: 1 }),
    episode: integer(payload.episode, 'episode', { defaultValue: 0, min: 0 }),
    completed_at: completedAt,
    reminder_at: isoDate(payload.reminder_at, 'reminder_at'),
  }
}

export { mediaStatuses, mediaTypes, normalizeMediaPayload }
