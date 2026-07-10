export const knownTitleCorrections = new Map([
  ['tomadachi game', 'Tomodachi Game'],
])

export const knownMediaCollections = [
  {
    label: 'The Godfather franchise',
    aliases: ['godfather franchise', 'the godfather franchise', 'godfather trilogy', 'the godfather trilogy'],
    titles: ['The Godfather', 'The Godfather Part II', 'The Godfather Part III'],
  },
  {
    label: 'Fast and Furious franchise',
    aliases: ['fast and furious franchise', 'fast & furious franchise'],
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
    aliases: ['rocky franchise'],
    titles: ['Rocky', 'Rocky II', 'Rocky III', 'Rocky IV', 'Rocky V', 'Rocky Balboa'],
  },
  {
    label: 'Rambo franchise',
    aliases: ['rambo franchise'],
    titles: ['First Blood', 'Rambo: First Blood Part II', 'Rambo III', 'Rambo', 'Rambo: Last Blood'],
  },
  {
    label: 'Creed franchise',
    aliases: ['creed franchise'],
    titles: ['Creed', 'Creed II', 'Creed III'],
  },
  {
    label: 'Thor franchise',
    aliases: ['thor franchise'],
    titles: ['Thor', 'Thor: The Dark World', 'Thor: Ragnarok', 'Thor: Love and Thunder'],
  },
  {
    label: 'Iron Man franchise',
    aliases: ['iron man franchise'],
    titles: ['Iron Man', 'Iron Man 2', 'Iron Man 3'],
  },
  {
    label: 'The Avengers collection',
    aliases: ['avengers collection', 'the avengers collection', 'avengers movies', 'the avengers movies', 'avengers franchise'],
    titles: ['The Avengers', 'Avengers: Age of Ultron', 'Avengers: Infinity War', 'Avengers: Endgame'],
  },
  {
    label: 'John Wick franchise',
    aliases: ['john wick franchise'],
    titles: ['John Wick', 'John Wick: Chapter 2', 'John Wick: Chapter 3 - Parabellum', 'John Wick: Chapter 4'],
  },
  {
    label: 'Star Wars prequel trilogy',
    aliases: ['prequel trilogy star wars', 'star wars prequel trilogy'],
    titles: ['Star Wars: Episode I - The Phantom Menace', 'Star Wars: Episode II - Attack of the Clones', 'Star Wars: Episode III - Revenge of the Sith'],
  },
  {
    label: 'Star Wars original trilogy',
    aliases: ['original star wars trilogy', 'star wars original trilogy'],
    titles: ['Star Wars: Episode IV - A New Hope', 'Star Wars: Episode V - The Empire Strikes Back', 'Star Wars: Episode VI - Return of the Jedi'],
  },
  {
    label: 'Cars trilogy',
    aliases: ['cars trilogy'],
    titles: ['Cars', 'Cars 2', 'Cars 3'],
  },
  {
    label: 'Pirates of the Caribbean franchise',
    aliases: ['pirates of caribbean franchise', 'pirates of the caribbean franchise'],
    titles: [
      'Pirates of the Caribbean: The Curse of the Black Pearl',
      'Pirates of the Caribbean: Dead Man\'s Chest',
      'Pirates of the Caribbean: At World\'s End',
      'Pirates of the Caribbean: On Stranger Tides',
      'Pirates of the Caribbean: Dead Men Tell No Tales',
    ],
  },
  {
    label: 'Before trilogy',
    aliases: ['before trilogy'],
    titles: ['Before Sunrise', 'Before Sunset', 'Before Midnight'],
  },
  {
    label: 'The Hangover trilogy',
    aliases: ['hangover trilogy', 'the hangover trilogy'],
    titles: ['The Hangover', 'The Hangover Part II', 'The Hangover Part III'],
  },
  {
    label: 'Rush Hour franchise',
    aliases: ['rush hour franchise', 'rush hour series', 'rush hour collection', 'rush hour trilogy', 'rush hour 1 and 2', 'rush hour 1 & 2', 'rush hour one and two'],
    titles: ['Rush Hour', 'Rush Hour 2', 'Rush Hour 3'],
  },
  {
    label: 'The Dark Knight trilogy',
    aliases: ['dark knight trilogy', 'the dark knight trilogy'],
    titles: ['Batman Begins', 'The Dark Knight', 'The Dark Knight Rises'],
  },
  {
    label: 'Tobey Maguire Spider-Man trilogy',
    aliases: ['toby maguire spiderman trilogy', 'tobey maguire spider-man trilogy', 'tobey maguire spiderman trilogy'],
    titles: ['Spider-Man', 'Spider-Man 2', 'Spider-Man 3'],
  },
  {
    label: 'Tom Holland Spider-Man trilogy',
    aliases: ['tom holland spiderman trilogy', 'tom holland spider-man trilogy'],
    titles: ['Spider-Man: Homecoming', 'Spider-Man: Far From Home', 'Spider-Man: No Way Home'],
  },
]

function normalizeKnownTitle(title) {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .replace(/^\d+[).:-]\s*/, '')
    .trim()
}

function normalizeMediaTitle(title) {
  return String(title || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function uniqueList(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}

export function applyKnownTitleCorrection(title) {
  const normalized = normalizeKnownTitle(title)
  return knownTitleCorrections.get(normalized.toLowerCase()) || normalized
}

export function titleMatchKey(value) {
  return normalizeMediaTitle(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(?:the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function knownCollectionForTitle(title) {
  const key = titleMatchKey(title)
  return knownMediaCollections.find((collection) =>
    collection.titles.some((collectionTitle) => titleMatchKey(collectionTitle) === key),
  )
}

export function knownCollectionTitle(title, collection) {
  const key = titleMatchKey(title)
  return collection?.titles.find((collectionTitle) => titleMatchKey(collectionTitle) === key) || title
}

function normalizedCollectionText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(entire|whole|all|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findKnownCollection(title) {
  const text = normalizedCollectionText(title)
  return knownMediaCollections.find((collection) =>
    collection.aliases.some((alias) => {
      const normalizedAlias = normalizedCollectionText(alias)
      return text === normalizedAlias || text.includes(normalizedAlias)
    }),
  )
}

export function selectedCollectionTitles(sourceTitle, collection) {
  const text = normalizedCollectionText(sourceTitle)
  const rangeMatch = text.match(/\b([1-9])\s*(?:and|to|through|-)\s*([1-9])\b/)
  if (rangeMatch) {
    const start = Math.max(1, Number(rangeMatch[1]))
    const end = Math.min(collection.titles.length, Number(rangeMatch[2]))
    if (start <= end) return collection.titles.slice(start - 1, end)
  }

  const listedNumbers = [...text.matchAll(/\b([1-9])\b/g)]
    .map((match) => Number(match[1]))
    .filter((number) => number >= 1 && number <= collection.titles.length)
  const uniqueNumbers = uniqueList(listedNumbers)
  if (uniqueNumbers.length > 0) {
    return uniqueNumbers.map((number) => collection.titles[number - 1])
  }

  return /\b(excluding|except|skip)\s+(the\s+)?first\b/i.test(sourceTitle)
    ? collection.titles.slice(1)
    : collection.titles
}
