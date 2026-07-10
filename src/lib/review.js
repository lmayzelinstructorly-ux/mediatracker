const needsReviewTag = 'Needs review'

function uniqueStrings(items) {
  return [...new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))]
}

function hasNeedsReview(item) {
  return Array.isArray(item?.tags) && item.tags.some((tag) => String(tag).toLowerCase() === needsReviewTag.toLowerCase())
}

function withoutNeedsReview(tags) {
  return uniqueStrings(tags).filter((tag) => tag.toLowerCase() !== needsReviewTag.toLowerCase())
}

function buildResolvedMedia(item, candidate) {
  const candidateGenres = Array.isArray(candidate?.genres) ? candidate.genres : []
  const candidateTags = Array.isArray(candidate?.tags) ? candidate.tags : []

  return {
    ...item,
    ...candidate,
    status: item.status,
    priority: item.priority,
    personal_rating: item.personal_rating,
    reflection: item.reflection,
    season: item.season,
    episode: item.episode,
    completed_at: item.completed_at,
    reminder_at: item.reminder_at,
    genres: candidateGenres.length ? candidateGenres : item.genres || [],
    tags: uniqueStrings([
      ...withoutNeedsReview(item.tags),
      ...candidateTags,
      ...candidateGenres,
    ]),
  }
}

function buildCustomMedia(item) {
  return {
    ...item,
    tmdb_id: null,
    type: 'custom',
    tags: uniqueStrings([...withoutNeedsReview(item.tags), 'Custom']),
  }
}

export {
  buildCustomMedia,
  buildResolvedMedia,
  hasNeedsReview,
  needsReviewTag,
  withoutNeedsReview,
}
