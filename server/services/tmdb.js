import {
  parseSearchQuery,
  rankTmdbResults,
  selectBestTmdbMatch,
} from './media-match.js'

export function createTmdbService({ tmdbKey, tmdbToken, posterBase }) {
  async function tmdbFetch(url) {
    const headers = tmdbToken ? { Authorization: `Bearer ${tmdbToken}` } : {}
    const keyParam = tmdbKey ? `${url.includes('?') ? '&' : '?'}api_key=${tmdbKey}` : ''
    const response = await fetch(`${url}${keyParam}`, { headers })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`TMDB request failed: ${response.status} ${text}`)
    }
    return response.json()
  }

  function tmdbMediaType(sourceType) {
    return sourceType === 'tv' ? 'show' : 'movie'
  }

  function mapTmdbResult(item, sourceType) {
    const title = item.title || item.name || item.original_title || item.original_name
    const date = item.release_date || item.first_air_date || ''
    return {
      tmdb_id: item.id,
      title,
      type: tmdbMediaType(sourceType),
      cover_art: item.poster_path ? `${posterBase}${item.poster_path}` : '',
      description: item.overview || '',
      release_year: date ? date.slice(0, 4) : '',
      tmdb_rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : null,
      genres: [],
      tags: [],
      runtime: 0,
    }
  }

  async function hydrateTmdb(item, sourceType) {
    const detailType = sourceType === 'tv' ? 'tv' : 'movie'
    const detail = await tmdbFetch(`https://api.themoviedb.org/3/${detailType}/${item.tmdb_id}?language=en-US`)
    const genres = (detail.genres || []).map((genre) => genre.name)
    return {
      ...item,
      genres,
      tags: genres,
      runtime:
        detail.runtime ||
        (Array.isArray(detail.episode_run_time) ? detail.episode_run_time[0] : 0) ||
        0,
    }
  }

  async function findBestTmdb(title, type, preferredYear = '') {
    try {
      const hints = parseSearchQuery(title)
      const query = hints.title
      const effectiveType = type === 'custom' ? hints.preferredType || '' : type
      const effectiveYear = preferredYear || hints.preferredYear
      const data = await tmdbFetch(`https://api.themoviedb.org/3/search/multi?language=en-US&include_adult=false&query=${encodeURIComponent(query)}`)
      const match = selectBestTmdbMatch(query, data.results, {
        preferredType: effectiveType,
        preferredYear: effectiveYear,
      })
      if (!match) return null
      const normalized = mapTmdbResult(match, match.media_type)
      return hydrateTmdb(normalized, match.media_type)
    } catch {
      return null
    }
  }

  return {
    findBestTmdb,
    hydrateTmdb,
    mapTmdbResult,
    parseSearchQuery,
    rankTmdbResults,
    tmdbFetch,
    tmdbMediaType,
  }
}
