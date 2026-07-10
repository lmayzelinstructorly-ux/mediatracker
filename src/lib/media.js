export const tabs = ['Watched', 'Want to Watch', 'Want to Rewatch']
export const types = ['movie', 'show', 'anime', 'custom']
export const fallbackPoster =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80'

function mediaTypeFamily(type) {
  return type === 'anime' ? 'show' : type || 'movie'
}

function normalizedMediaTitle(title) {
  return String(title || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function mediaKey(item) {
  const type = mediaTypeFamily(item.type)
  if (item.tmdb_id != null) return `tmdb|${type}|${item.tmdb_id}`
  return `title|${type}|${normalizedMediaTitle(item.title)}|${item.release_year || ''}`
}

function isSameMedia(left, right) {
  if (left.tmdb_id != null && right.tmdb_id != null) {
    return mediaKey(left) === mediaKey(right)
  }

  const sameTitle = normalizedMediaTitle(left.title) === normalizedMediaTitle(right.title)
  const sameType = mediaTypeFamily(left.type) === mediaTypeFamily(right.type)
  const yearsCompatible = !left.release_year || !right.release_year || String(left.release_year) === String(right.release_year)
  return sameTitle && sameType && yearsCompatible
}

const romanValues = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
}

const knownTitleCollections = [
  {
    label: 'The Godfather franchise',
    titles: ['The Godfather', 'The Godfather Part II', 'The Godfather Part III'],
  },
  {
    label: 'Fast and Furious franchise',
    titles: [
      'The Fast and the Furious',
      '2 Fast 2 Furious',
      'The Fast and the Furious: Tokyo Drift',
      'Fast & Furious',
      'Fast Five',
      'Fast & Furious 6',
      'Furious 7',
      'The Fate of the Furious',
      'F9',
      'Fast X',
    ],
  },
  {
    label: 'Rocky franchise',
    titles: ['Rocky', 'Rocky II', 'Rocky III', 'Rocky IV', 'Rocky V', 'Rocky Balboa'],
  },
  {
    label: 'Rambo franchise',
    titles: ['First Blood', 'Rambo: First Blood Part II', 'Rambo III', 'Rambo', 'Rambo: Last Blood'],
  },
  {
    label: 'Creed franchise',
    titles: ['Creed', 'Creed II', 'Creed III'],
  },
  {
    label: 'Thor franchise',
    titles: ['Thor', 'Thor: The Dark World', 'Thor: Ragnarok', 'Thor: Love and Thunder'],
  },
  {
    label: 'Iron Man franchise',
    titles: ['Iron Man', 'Iron Man 2', 'Iron Man 3'],
  },
  {
    label: 'The Avengers collection',
    titles: ['The Avengers', 'Avengers: Age of Ultron', 'Avengers: Infinity War', 'Avengers: Endgame'],
  },
  {
    label: 'John Wick franchise',
    titles: ['John Wick', 'John Wick: Chapter 2', 'John Wick: Chapter 3 - Parabellum', 'John Wick: Chapter 4'],
  },
  {
    label: 'The Dark Knight trilogy',
    titles: ['Batman Begins', 'The Dark Knight', 'The Dark Knight Rises'],
  },
  {
    label: 'Tobey Maguire Spider-Man trilogy',
    titles: ['Spider-Man', 'Spider-Man 2', 'Spider-Man 3'],
  },
  {
    label: 'Tom Holland Spider-Man trilogy',
    titles: ['Spider-Man: Homecoming', 'Spider-Man: Far From Home', 'Spider-Man: No Way Home'],
  },
  {
    label: 'Rush Hour franchise',
    titles: ['Rush Hour', 'Rush Hour 2', 'Rush Hour 3'],
  },
]

function romanToNumber(value) {
  const roman = String(value || '').toLowerCase()
  if (!/^[ivxlcdm]+$/.test(roman)) return null
  return [...roman].reduceRight((total, letter, index, letters) => {
    const number = romanValues[letter] || 0
    const nextNumber = romanValues[letters[index + 1]] || 0
    return number < nextNumber ? total - number : total + number
  }, 0)
}

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019']/g, '')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleSortKey(value) {
  return normalizeTitle(value).toLowerCase()
}

function titleMatchKey(value) {
  return titleSortKey(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(?:the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function knownCollectionForTitle(title) {
  const key = titleMatchKey(title)
  return knownTitleCollections.find((collection) =>
    collection.titles.some((collectionTitle) => titleMatchKey(collectionTitle) === key),
  )
}

function tagCollectionName(item) {
  const tags = Array.isArray(item.tags) ? item.tags : []
  return tags.find((tag) => /\b(franchise|trilogy|saga|series|collection|universe)\b/i.test(tag) && !/^collection$/i.test(tag))
}

function collectionName(item) {
  const tagName = tagCollectionName(item)
  if (tagName) return tagName

  const knownCollection = knownCollectionForTitle(item.title)
  if (knownCollection) return knownCollection.label

  return inferredCollectionName(item.title)
}

function inferredCollectionName(title) {
  const cleanTitle = normalizeTitle(title).replace(/\s*\([^)]*\)\s*$/g, '').trim()
  const withoutSubtitle = cleanTitle.replace(/\s*[-:\u2013\u2014]\s*.+$/u, '').trim()
  const withoutPart = withoutSubtitle
    .replace(/\s+(?:part|chapter|episode|vol(?:ume)?\.?)\s+(?:[ivxlcdm]+|\d+)\b.*$/i, '')
    .replace(/\s+(?:[ivxlcdm]+|\d+)\s*$/i, '')
    .trim()

  return withoutPart || cleanTitle
}

function collectionKey(item) {
  return `${item.type || 'movie'}|${titleSortKey(collectionName(item))}`
}

function sequenceNumber(item) {
  const title = normalizeTitle(item.title)
  const knownCollection = knownCollectionForTitle(item.title)
  if (knownCollection) {
    const index = knownCollection.titles.findIndex((collectionTitle) => titleMatchKey(collectionTitle) === titleMatchKey(item.title))
    return index >= 0 ? index + 1 : Number.POSITIVE_INFINITY
  }

  if (titleSortKey(title) === titleSortKey(inferredCollectionName(title))) return 1
  const partMatch = title.match(/\b(?:part|chapter|episode|vol(?:ume)?\.?)\s+([ivxlcdm]+|\d+)\b/i)
  const trailingMatch = title.match(/\s([ivxlcdm]+|\d+)$/i)
  const value = partMatch?.[1] || trailingMatch?.[1]
  if (!value) return Number.POSITIVE_INFINITY
  return /^\d+$/.test(value) ? Number(value) : romanToNumber(value)
}

function compareCollectionItems(a, b) {
  const sequenceA = sequenceNumber(a)
  const sequenceB = sequenceNumber(b)
  if (sequenceA !== sequenceB) return sequenceA - sequenceB
  if ((a.release_year || 0) !== (b.release_year || 0)) return (a.release_year || 0) - (b.release_year || 0)
  return titleSortKey(a.title).localeCompare(titleSortKey(b.title))
}

function groupedMediaItems(items) {
  const buckets = items.reduce((groups, item) => {
    const key = collectionKey(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
    return groups
  }, new Map())

  return [...buckets.values()]
    .map((group) => {
      const sortedItems = [...group].sort(compareCollectionItems)
      return {
        id: collectionKey(sortedItems[0]),
        name: collectionName(sortedItems[0]),
        items: sortedItems,
        isCollection: sortedItems.length > 1,
        priority: Math.max(...sortedItems.map((item) => item.priority || 0)),
      }
    })
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return titleSortKey(a.name).localeCompare(titleSortKey(b.name))
    })
}

export {
  groupedMediaItems,
  isSameMedia,
  mediaKey,
}
