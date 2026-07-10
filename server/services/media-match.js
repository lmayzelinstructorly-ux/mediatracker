function normalizeMatchTitle(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(?:the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(left, right) {
  const a = normalizeMatchTitle(left)
  const b = normalizeMatchTitle(right)
  if (!a) return b.length
  if (!b) return a.length

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[b.length]
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(normalizeMatchTitle(left).split(' ').filter(Boolean))
  const rightTokens = new Set(normalizeMatchTitle(right).split(' ').filter(Boolean))
  if (!leftTokens.size || !rightTokens.size) return 0
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  return (2 * intersection) / (leftTokens.size + rightTokens.size)
}

function textSimilarity(left, right) {
  const a = normalizeMatchTitle(left)
  const b = normalizeMatchTitle(right)
  if (!a || !b) return 0
  if (a === b) return 1

  const characterScore = 1 - levenshtein(a, b) / Math.max(a.length, b.length)
  const tokenScore = tokenSimilarity(a, b)
  const containmentBonus = a.includes(b) || b.includes(a) ? 0.08 : 0
  return Math.min(1, Math.max(0, characterScore * 0.45 + tokenScore * 0.55 + containmentBonus))
}

function candidateTitles(item) {
  return [...new Set([
    item.title,
    item.name,
    item.original_title,
    item.original_name,
  ].map((value) => String(value || '').trim()).filter(Boolean))]
}

function candidateYear(item) {
  const date = item.release_date || item.first_air_date || ''
  const year = Number(String(date).slice(0, 4))
  return Number.isInteger(year) ? year : null
}

function parseSearchQuery(value) {
  const original = String(value || '').trim()
  let title = original
  let preferredYear = ''
  let preferredType = ''

  for (let pass = 0; pass < 2; pass += 1) {
    const yearMatch = title.match(/\s*(?:\((19\d{2}|20\d{2})\)|\[(19\d{2}|20\d{2})\]|(19\d{2}|20\d{2}))\s*$/)
    if (yearMatch && !preferredYear) {
      preferredYear = yearMatch[1] || yearMatch[2] || yearMatch[3]
      title = title.slice(0, yearMatch.index).trim()
      continue
    }

    const typeMatch = title.match(/\s+(movie|film|tv|show|series|anime)\s*$/i)
    if (typeMatch && !preferredType) {
      const hint = typeMatch[1].toLowerCase()
      preferredType = hint === 'movie' || hint === 'film' ? 'movie' : hint === 'anime' ? 'anime' : 'show'
      title = title.slice(0, typeMatch.index).trim()
    }
  }

  return {
    title: title || original,
    preferredYear,
    preferredType,
  }
}

function scoreTmdbCandidate(query, item, { preferredType = '', preferredYear = '' } = {}) {
  const variants = candidateTitles(item)
  const similarities = variants.map((title) => ({
    title,
    similarity: textSimilarity(query, title),
    exact: normalizeMatchTitle(query) === normalizeMatchTitle(title),
  }))
  const bestTitle = similarities.sort((left, right) => right.similarity - left.similarity)[0] || {
    similarity: 0,
    exact: false,
  }

  let score = bestTitle.similarity * 100
  if (bestTitle.exact) score += 28

  if (preferredType === 'movie' || preferredType === 'show') {
    const expected = preferredType === 'show' ? 'tv' : 'movie'
    score += item.media_type === expected ? 32 : -48
  } else if (preferredType === 'anime') {
    const animation = Array.isArray(item.genre_ids) && item.genre_ids.includes(16)
    const japanese = item.original_language === 'ja'
    score += animation ? 18 : -8
    score += japanese ? 12 : 0
  }

  const year = candidateYear(item)
  const requestedYear = Number(preferredYear)
  let yearDifference = null
  if (requestedYear && year) {
    yearDifference = Math.abs(requestedYear - year)
    if (yearDifference === 0) score += 34
    else if (yearDifference === 1) score += 12
    else if (yearDifference === 2) score += 4
    else score -= Math.min(24, yearDifference * 2)
  } else if (requestedYear && !year) {
    score -= 4
  }

  const popularity = Math.max(0, Number(item.popularity) || 0)
  const voteCount = Math.max(0, Number(item.vote_count) || 0)
  score += Math.min(6, Math.log10(popularity + 1) * 2)
  score += Math.min(4, voteCount / 1000)

  return {
    item,
    score,
    similarity: bestTitle.similarity,
    exact: bestTitle.exact,
    yearDifference,
  }
}

function rankTmdbResults(query, results, options = {}) {
  return (results || [])
    .filter((item) => ['movie', 'tv'].includes(item.media_type))
    .map((item) => scoreTmdbCandidate(query, item, options))
    .sort((left, right) =>
      right.score - left.score ||
      right.similarity - left.similarity ||
      (Number(right.item.popularity) || 0) - (Number(left.item.popularity) || 0),
    )
}

function selectBestTmdbMatch(query, results, options = {}) {
  const ranked = rankTmdbResults(query, results, options)
  const top = ranked[0]
  if (!top || top.similarity < 0.58 || top.score < 62) return null

  const second = ranked[1]
  if (second) {
    const noHints = !options.preferredType && !options.preferredYear
    const crossTypeExactTie = noHints && top.exact && second.exact && top.item.media_type !== second.item.media_type
    if (crossTypeExactTie) return null

    const closeLowConfidenceRace = top.score - second.score < 4 &&
      Math.abs(top.similarity - second.similarity) < 0.06 &&
      !top.exact
    if (closeLowConfidenceRace) return null
  }

  return top.item
}

export {
  normalizeMatchTitle,
  parseSearchQuery,
  rankTmdbResults,
  scoreTmdbCandidate,
  selectBestTmdbMatch,
  textSimilarity,
}
