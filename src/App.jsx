import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  Clapperboard,
  Clock,
  Download,
  FileText,
  Film,
  Lightbulb,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Tags,
  Trash2,
  Upload,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './index.css'

const pages = [
  { id: 'lists', label: 'My Lists', icon: Film },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const tabs = ['Watched', 'Want to Watch', 'Want to Rewatch']
const types = ['movie', 'show', 'anime', 'custom']
const fallbackPoster =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80'

async function api(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || response.statusText)
  }
  if (response.status === 204) return null
  return response.json()
}

async function uploadApi(path, formData) {
  const response = await fetch(`/api${path}`, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || response.statusText)
  }
  return response.json()
}

function classNames(...items) {
  return items.filter(Boolean).join(' ')
}

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

function App() {
  const [page, setPage] = useState('lists')
  const [media, setMedia] = useState([])
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [activeTab, setActiveTab] = useState('Want to Watch')
  const [filter, setFilter] = useState('')
  const [tmdbQuery, setTmdbQuery] = useState('')
  const [tmdbResults, setTmdbResults] = useState([])
  const [tmdbSuggestions, setTmdbSuggestions] = useState([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [selectedSuggestionQuery, setSelectedSuggestionQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [pdfImporting, setPdfImporting] = useState(false)
  const [pdfImportResult, setPdfImportResult] = useState(null)
  const [backupImporting, setBackupImporting] = useState(false)
  const [backupRestoring, setBackupRestoring] = useState(false)
  const [backupFileName, setBackupFileName] = useState('')
  const [backupDraft, setBackupDraft] = useState(null)
  const [backupPreview, setBackupPreview] = useState(null)
  const [backupConfirmed, setBackupConfirmed] = useState(false)
  const [toast, setToast] = useState('')
  const [addingKeys, setAddingKeys] = useState(() => new Set())
  const [completionDraft, setCompletionDraft] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [recommendationMeta, setRecommendationMeta] = useState(null)
  const [recMode, setRecMode] = useState('personalized')
  const [mood, setMood] = useState('')
  const [timelineYear, setTimelineYear] = useState('all')
  const [timelineType, setTimelineType] = useState('all')
  const [theme, setTheme] = useState(() => localStorage.getItem('media-theme') || 'dark')
  const [notifications, setNotifications] = useState(() => localStorage.getItem('media-notifications') !== 'off')

  const pendingReminders = media.filter((item) => item.reminder_at && item.status !== 'Watched').length

  const loadMedia = useCallback(async () => {
    setMedia(await api('/media'))
  }, [])

  const loadStats = useCallback(async () => {
    setStats(await api('/stats'))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('media-theme', theme)
  }, [theme])

  useEffect(() => {
    loadMedia()
    api('/health').then(setHealth).catch(() => setHealth(null))
  }, [loadMedia])

  useEffect(() => {
    if (page === 'stats') loadStats()
  }, [page, media.length, loadStats])

  useEffect(() => {
    const query = tmdbQuery.trim()
    if (query.length < 2) {
      setTmdbSuggestions([])
      setSuggestionsOpen(false)
      return undefined
    }

    if (query === selectedSuggestionQuery) {
      setSuggestionsOpen(false)
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true)
      try {
        const response = await fetch(`/api/search/tmdb?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(response.statusText)
        const results = await response.json()
        setTmdbSuggestions(results.slice(0, 6))
        setSuggestionsOpen(true)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setTmdbSuggestions([])
        }
      } finally {
        setSuggestionsLoading(false)
      }
    }, 260)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [selectedSuggestionQuery, tmdbQuery])

  useEffect(() => {
    if (!notifications) return undefined
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    const timer = window.setInterval(() => {
      const now = Date.now()
      media.forEach((item) => {
        const key = `reminded-${item.id}-${item.reminder_at}`
        if (item.reminder_at && !localStorage.getItem(key) && new Date(item.reminder_at).getTime() <= now) {
          localStorage.setItem(key, '1')
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Watch nudge: ${item.title}`, {
              body: 'This one has been waiting in your queue.',
              icon: item.cover_art || undefined,
            })
          } else {
            setToast(`Reminder: ${item.title}`)
          }
        }
      })
    }, 15000)
    return () => window.clearInterval(timer)
  }, [media, notifications])

  async function searchTmdb(event) {
    event.preventDefault()
    if (!tmdbQuery.trim()) return
    setLoading(true)
    try {
      const results = await api(`/search/tmdb?q=${encodeURIComponent(tmdbQuery)}`)
      setTmdbResults(results)
      setTmdbSuggestions(results.slice(0, 6))
      setSuggestionsOpen(false)
    } catch (error) {
      setToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function addMedia(item, status = 'Want to Watch') {
    const key = mediaKey(item)
    const existing = media.find((savedItem) => isSameMedia(savedItem, item))
    if (existing) {
      setToast(`${existing.title} is already in ${existing.status}`)
      setSuggestionsOpen(false)
      return existing
    }

    setAddingKeys((current) => new Set(current).add(key))
    try {
      const saved = await api('/media', {
        method: 'POST',
        body: JSON.stringify({ ...item, status, priority: media.length + 1 }),
      })
      setMedia((current) => {
        const currentIndex = current.findIndex((savedItem) => isSameMedia(savedItem, saved))
        if (currentIndex >= 0) {
          return current.map((savedItem, index) => (index === currentIndex ? saved : savedItem))
        }
        return [saved, ...current]
      })
      setToast(saved.duplicate ? `${saved.title} is already in ${saved.status}` : `${saved.title} added`)
      setSuggestionsOpen(false)
      return saved
    } catch (error) {
      setToast(error.message)
      return null
    } finally {
      setAddingKeys((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function importPdfWatchlist(file) {
    if (!file) return
    setPdfImporting(true)
    setPdfImportResult(null)
    try {
      const formData = new FormData()
      formData.append('watchlist', file)
      const result = await uploadApi('/import/pdf', formData)
      setPdfImportResult(result)
      await loadMedia()
      setToast(`Imported ${result.created?.length || 0} titles from ${file.name}`)
    } catch (error) {
      setToast(error.message)
    } finally {
      setPdfImporting(false)
    }
  }

  async function exportBackup() {
    try {
      const backup = await api('/backup/export')
      const today = new Date().toISOString().slice(0, 10)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `mediatracker-backup-${today}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setToast('Backup exported')
    } catch (error) {
      setToast(error.message)
    }
  }

  async function previewBackupFile(file) {
    if (!file) return
    setBackupImporting(true)
    setBackupFileName(file.name)
    setBackupPreview(null)
    setBackupDraft(null)
    setBackupConfirmed(false)
    try {
      const backup = JSON.parse(await file.text())
      const preview = await api('/backup/preview', {
        method: 'POST',
        body: JSON.stringify(backup),
      })
      setBackupDraft(backup)
      setBackupPreview(preview)
      setToast(`Backup preview ready: ${preview.willCreate} new titles`)
    } catch (error) {
      setToast(error.message)
    } finally {
      setBackupImporting(false)
    }
  }

  async function restoreBackup() {
    if (!backupDraft || !backupPreview || !backupConfirmed) return
    setBackupRestoring(true)
    try {
      const result = await api('/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ backup: backupDraft, mode: 'merge' }),
      })
      await loadMedia()
      setBackupPreview({
        ok: true,
        total: result.created.length + result.skipped.length + result.invalid.length,
        restored: true,
        willCreate: 0,
        create: result.created.map((item) => ({
          title: item.title,
          type: item.type || 'movie',
          status: item.status || 'Want to Watch',
        })),
        duplicates: result.skipped,
        invalid: result.invalid,
      })
      setBackupConfirmed(false)
      setToast(`Restored ${result.created.length} titles, skipped ${result.skipped.length} duplicates`)
    } catch (error) {
      setToast(error.message)
    } finally {
      setBackupRestoring(false)
    }
  }

  async function patchMedia(id, payload) {
    const saved = await api(`/media/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    setMedia((current) => current.map((item) => (item.id === id ? saved : item)))
    return saved
  }

  async function removeMedia(id) {
    await api(`/media/${id}`, { method: 'DELETE' })
    setMedia((current) => current.filter((item) => item.id !== id))
  }

  function beginComplete(item) {
    setCompletionDraft({
      ...item,
      personal_rating: item.personal_rating || 8,
      reflection: item.reflection || '',
    })
  }

  async function finishComplete(event) {
    event.preventDefault()
    await patchMedia(completionDraft.id, {
      ...completionDraft,
      status: 'Watched',
      completed_at: new Date().toISOString(),
    })
    setCompletionDraft(null)
  }

  async function runRecommendations(mode = recMode, context = mood) {
    setLoading(true)
    setRecMode(mode)
    try {
      const payload = await api('/recommendations', {
        method: 'POST',
        body: JSON.stringify({ mode, context }),
      })
      setRecommendations(Array.isArray(payload) ? payload : payload.suggestions || [])
      setRecommendationMeta(Array.isArray(payload) ? null : payload)
    } catch (error) {
      setToast(error.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredMedia = useMemo(() => {
    const term = filter.toLowerCase().trim()
    return media
      .filter((item) => item.status === activeTab)
      .filter((item) => {
        if (!term) return true
        return [item.title, item.type, item.status, ...(item.tags || []), ...(item.genres || [])]
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
  }, [media, activeTab, filter])

  const timeline = useMemo(() => {
    return media
      .filter((item) => item.status === 'Watched' && item.completed_at)
      .filter((item) => timelineYear === 'all' || item.completed_at.startsWith(timelineYear))
      .filter((item) => timelineType === 'all' || item.type === timelineType)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
  }, [media, timelineYear, timelineType])

  const years = [...new Set(media.filter((item) => item.completed_at).map((item) => item.completed_at.slice(0, 4)))]

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-500">
      <div className="cinema-backdrop" />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 md:px-7">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-5 md:flex-row md:items-center md:justify-between">
          <button className="group flex items-center gap-3 text-left" onClick={() => setPage('lists')}>
            <span className="grid h-11 w-11 place-items-center rounded border border-white/15 bg-white/8 shadow-2xl backdrop-blur">
              <Clapperboard className="h-5 w-5 text-amber-300" />
            </span>
            <span>
              <span className="block text-xl font-semibold tracking-[0.08em] text-[var(--heading)] uppercase">MediaTracker</span>
              <span className="text-sm text-[var(--muted)]">A private cinema ledger</span>
            </span>
          </button>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {pages.map((nav) => {
              const Icon = nav.icon
              return (
                <button
                  key={nav.id}
                  onClick={() => setPage(nav.id)}
                  className={classNames('nav-button', page === nav.id && 'nav-button-active')}
                >
                  <Icon className="h-4 w-4" />
                  <span>{nav.label}</span>
                  {nav.id === 'settings' && pendingReminders > 0 && <b>{pendingReminders}</b>}
                </button>
              )
            })}
          </nav>
        </header>

        {toast && (
          <button className="fixed right-5 top-5 z-50 rounded border border-white/15 bg-zinc-950/90 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur" onClick={() => setToast('')}>
            {toast}
          </button>
        )}

        {page === 'lists' && (
          <section className="grid gap-8 lg:grid-cols-[370px_1fr]">
            <aside className="space-y-5">
              <Panel className={suggestionsOpen ? 'panel-raised' : ''}>
                <form onSubmit={searchTmdb} className="space-y-4">
                  <SectionTitle icon={Search} title="Add by title" kicker="TMDB metadata search" />
                  <div className="suggest-wrap">
                    <div className="search-row">
                      <input
                        value={tmdbQuery}
                        onChange={(event) => {
                          setSelectedSuggestionQuery('')
                          setTmdbQuery(event.target.value)
                        }}
                        onFocus={() => setSuggestionsOpen(tmdbSuggestions.length > 0 && tmdbQuery.trim() !== selectedSuggestionQuery)}
                        placeholder="Search a movie, show, or anime"
                      />
                      <button title="Search" disabled={loading}>
                        <Search className="h-4 w-4" />
                      </button>
                    </div>
                    {suggestionsOpen && (
                      <div className="suggest-menu">
                        {suggestionsLoading && <p className="suggest-hint">Looking...</p>}
                        {!suggestionsLoading && tmdbSuggestions.map((item) => (
                          <button
                            type="button"
                            key={`suggest-${item.tmdb_id}-${item.title}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setSelectedSuggestionQuery(item.title)
                              setTmdbQuery(item.title)
                              setTmdbResults([item])
                              setSuggestionsOpen(false)
                            }}
                          >
                            <img src={item.cover_art || fallbackPoster} alt="" />
                            <span>
                              <strong>{item.title}</strong>
                              <small>{item.type} / {item.release_year || 'unknown'} / {item.genres?.slice(0, 2).join(', ') || 'TMDB match'}</small>
                            </span>
                          </button>
                        ))}
                        {!suggestionsLoading && tmdbSuggestions.length === 0 && <p className="suggest-hint">No matches yet</p>}
                      </div>
                    )}
                  </div>
                </form>
                <div className="mt-4 space-y-3">
                  {tmdbResults.map((item) => (
                    <SearchResult
                      key={`${item.tmdb_id}-${item.title}`}
                      item={item}
                      existing={media.find((savedItem) => isSameMedia(savedItem, item))}
                      adding={addingKeys.has(mediaKey(item))}
                      onAdd={addMedia}
                    />
                  ))}
                </div>
              </Panel>

              <Panel>
                <SectionTitle icon={Plus} title="Custom entry" kicker="Offline friendly" />
                <CustomEntry onAdd={addMedia} />
              </Panel>

              <Panel>
                <SectionTitle icon={FileText} title="PDF import" kicker="AI watchlist parser" />
                <PdfImportPanel
                  importing={pdfImporting}
                  result={pdfImportResult}
                  onImport={importPdfWatchlist}
                />
              </Panel>
            </aside>

            <section className="space-y-5">
              <div className="lists-heading">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-amber-300">My Lists</p>
                  <h1 className="mt-2 text-4xl font-semibold text-[var(--heading)] md:text-5xl">Watchlist, remembered.</h1>
                </div>
                <div className="search-row list-filter">
                  <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter title, tag, type, status" />
                  <Search className="h-4 w-4 text-[var(--muted)]" />
                </div>
              </div>

              <div className="tab-row">
                {tabs.map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={classNames(activeTab === tab && 'active')}>
                    {tab}
                    <span>{media.filter((item) => item.status === tab).length}</span>
                  </button>
                ))}
              </div>

              <MediaGrid
                items={filteredMedia}
                onComplete={beginComplete}
                onPatch={patchMedia}
                onDelete={removeMedia}
                onSimilar={(item) => runRecommendations('similar', item.title)}
              />
            </section>
          </section>
        )}

        {page === 'recommendations' && (
          <section className="space-y-6">
            <PageIntro kicker="Gemini recommendations" title="Let the queue listen back." copy="Ask for personal, trending, mood-led, or title-adjacent picks. Results stay local until you choose to add them." />
            <Panel>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="grid gap-3 md:grid-cols-2">
                  <button className="command" onClick={() => runRecommendations('personalized', 'Analyze my whole library')}>Personalized</button>
                  <button className="command" onClick={() => runRecommendations('trending', 'Culturally popular right now')}>Trending refresh</button>
                  <div className="search-row md:col-span-2">
                    <input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="dark psychological thriller, cozy anime night, bleak prestige drama" />
                    <button title="Get mood picks" aria-label="Get mood picks" onClick={() => runRecommendations('mood', mood)}>
                      <Lightbulb className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <span className="text-sm text-[var(--muted)]">
                  {loading ? 'Thinking...' : `${recommendations.length} suggestions`}
                  {recommendationMeta?.model && ` / ${recommendationMeta.model}`}
                  {recommendationMeta?.fallbackCount > 0 && ` after ${recommendationMeta.fallbackCount} fallback${recommendationMeta.fallbackCount === 1 ? '' : 's'}`}
                </span>
              </div>
            </Panel>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {recommendations.map((item, index) => (
                <article key={`${item.title}-${index}`} className="frosted p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="pill">{item.type}</span>
                    <span className="text-sm text-amber-300">{item.confidence || 70}% match</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-[var(--heading)]">{item.title}</h2>
                  <p className="mt-3 min-h-16 text-sm leading-6 text-[var(--muted)]">{item.reason}</p>
                  <p className="mt-4 text-sm text-teal-300">{item.mood}{item.sourceModel && ` / ${item.sourceModel}`}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {page === 'stats' && (
          <section className="space-y-6">
            <PageIntro kicker="Personal stats" title="The shape of your viewing year." copy="A quiet dashboard for completed titles, hours, genre gravity, monthly activity, and your current year in review." />
            <StatsDashboard stats={stats} />
          </section>
        )}

        {page === 'timeline' && (
          <section className="space-y-6">
            <PageIntro kicker="Timeline" title="Every finished title, in order." copy="A chronological feed of watched media with rating, completion date, poster, and reflection note." />
            <div className="flex flex-wrap gap-3">
              <Select value={timelineYear} onChange={setTimelineYear} options={['all', ...years]} />
              <Select value={timelineType} onChange={setTimelineType} options={['all', ...types]} />
            </div>
            <div className="space-y-4">
              {timeline.map((item) => <TimelineItem key={item.id} item={item} />)}
              {!timeline.length && <EmptyState text="No completed entries match this filter." />}
            </div>
          </section>
        )}

        {page === 'settings' && (
          <section className="space-y-6">
            <PageIntro kicker="Settings" title="Local controls, no account required." copy="Configure app preferences, notification behavior, and confirm whether backend API keys are present." />
            <div className="grid gap-4 md:grid-cols-2">
              <Panel>
                <SectionTitle icon={Settings} title="API configuration" kicker="Read from .env" />
                <SettingRow label="Gemini API" value={health?.geminiConfigured ? 'Configured' : 'Missing'} />
                <SettingRow label="TMDB API" value={health?.tmdbConfigured ? 'Configured' : 'Missing'} />
                <p className="mt-4 text-sm text-[var(--muted)]">Keys live in the backend `.env` file so the browser never needs to hold them.</p>
              </Panel>
              <Panel>
                <SectionTitle icon={Bell} title="Preferences" kicker="Stored in browser" />
                <button className="setting-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                  {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
                </button>
                <button
                  className="setting-toggle mt-3"
                  onClick={() => {
                    const next = !notifications
                    setNotifications(next)
                    localStorage.setItem('media-notifications', next ? 'on' : 'off')
                  }}
                >
                  <Bell className="h-4 w-4" />
                  <span>{notifications ? 'Notifications on' : 'Notifications off'}</span>
                </button>
              </Panel>
              <Panel className="md:col-span-2">
                <SectionTitle icon={Download} title="Backup and restore" kicker="Local JSON" />
                <BackupPanel
                  fileName={backupFileName}
                  importing={backupImporting}
                  restoring={backupRestoring}
                  preview={backupPreview}
                  confirmed={backupConfirmed}
                  onExport={exportBackup}
                  onPreview={previewBackupFile}
                  onConfirm={setBackupConfirmed}
                  onRestore={restoreBackup}
                />
              </Panel>
            </div>
          </section>
        )}
      </div>

      {completionDraft && (
        <CompletionModal
          draft={completionDraft}
          setDraft={setCompletionDraft}
          onClose={() => setCompletionDraft(null)}
          onSubmit={finishComplete}
        />
      )}
    </main>
  )
}

function Panel({ children, className = '' }) {
  return <div className={classNames('frosted p-5', className)}>{children}</div>
}

function SectionTitle({ icon: Icon, title, kicker }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{kicker}</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-[var(--heading)]">
          <Icon className="h-4 w-4 text-amber-300" />
          {title}
        </h2>
      </div>
    </div>
  )
}

function PageIntro({ kicker, title, copy }) {
  return (
    <div className="max-w-4xl">
      <p className="text-sm uppercase tracking-[0.26em] text-amber-300">{kicker}</p>
      <h1 className="mt-2 text-4xl font-semibold text-[var(--heading)] md:text-6xl">{title}</h1>
      <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">{copy}</p>
    </div>
  )
}

function SearchResult({ item, existing, adding, onAdd }) {
  return (
    <article className={classNames('search-result', existing && 'search-result-saved')}>
      <img className="h-24 w-16 rounded object-cover" src={item.cover_art || fallbackPoster} alt="" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-medium text-[var(--heading)]">{item.title}</h3>
          {existing && <span className="saved-badge">{existing.status}</span>}
        </div>
        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{item.type} / {item.release_year || 'unknown'}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
        <div className="mt-3 flex gap-2">
          <button className="mini-button" disabled={adding || Boolean(existing)} onClick={() => onAdd(item, 'Want to Watch')}>
            {adding ? 'Adding...' : existing ? 'Saved' : 'Queue'}
          </button>
          <button className="mini-button" disabled={adding || Boolean(existing)} onClick={() => onAdd(item, 'Watched')}>Watched</button>
        </div>
      </div>
    </article>
  )
}

function CustomEntry({ onAdd }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('custom')

  async function submit(event) {
    event.preventDefault()
    if (!title.trim()) return
    await onAdd({
      title,
      type,
      cover_art: '',
      genres: [],
      tags: [],
      description: 'A custom local entry.',
      runtime: 45,
      release_year: '',
    })
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
      <Select value={type} onChange={setType} options={types} />
      <button className="command w-full" type="submit">Add custom media</button>
    </form>
  )
}

function PdfImportPanel({ importing, result, onImport }) {
  const [file, setFile] = useState(null)

  async function submit(event) {
    event.preventDefault()
    await onImport(file)
    setFile(null)
    event.currentTarget.reset()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="file-drop">
        <Upload className="h-5 w-5 text-amber-300" />
        <span className="min-w-0 flex-1 truncate">{file?.name || 'Choose PDF watchlist'}</span>
        <input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>
      <button className="command w-full" type="submit" disabled={!file || importing}>
        {importing ? 'Reading PDF...' : 'Import watchlist'}
      </button>
      {result && (
        <div className="rounded border border-white/10 bg-white/5 p-3 text-sm leading-6 text-[var(--muted)]">
          <p className="text-[var(--heading)]">{result.created?.length || 0} created / {result.skipped?.length || 0} skipped</p>
          {result.extractedItems && <p>{result.extractedItems} titles found in PDF</p>}
          {result.model && <p>{result.model}{result.fallbackCount > 0 ? ` after ${result.fallbackCount} fallbacks` : ''}</p>}
          <div className="import-result-list">
            {(result.created || []).slice(0, 12).map((item) => (
              <p key={item.id} className="truncate">{item.title} / {item.status}</p>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}

function BackupPanel({ fileName, importing, restoring, preview, confirmed, onExport, onPreview, onConfirm, onRestore }) {
  const canRestore = Boolean(preview?.ok && confirmed && !restoring)
  const createItems = preview?.create || []
  const duplicateItems = preview?.duplicates || []
  const invalidItems = preview?.invalid || []
  const createdMode = Boolean(preview?.restored)
  const createLabel = createdMode ? 'Created' : 'Will create'
  const createPrefix = createdMode ? 'Created' : 'Create'
  const createEmpty = createdMode ? 'No new titles were created.' : 'No new titles will be created.'

  async function submit(event) {
    event.preventDefault()
    await onPreview(event.currentTarget.elements.backupFile.files?.[0] || null)
    event.currentTarget.reset()
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="space-y-3">
        <button className="command w-full" type="button" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export backup
        </button>
        <form onSubmit={submit} className="space-y-3">
          <label className="file-drop" htmlFor="backup-file-input">
            <Upload className="h-5 w-5 text-amber-300" />
            <span className="min-w-0 flex-1 truncate">{fileName || 'Choose JSON backup'}</span>
            <input id="backup-file-input" name="backupFile" type="file" accept="application/json,.json" onChange={(event) => onPreview(event.target.files?.[0] || null)} />
          </label>
          <button className="secondary-command" type="submit" disabled={importing}>
            {importing ? 'Reading backup...' : 'Preview backup'}
          </button>
        </form>
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-3 text-sm leading-6 text-[var(--muted)]">
        {preview ? (
          <>
            <SettingRow label="Total items" value={preview.total} />
            <SettingRow label={createLabel} value={createdMode ? createItems.length : preview.willCreate} />
            <SettingRow label="Duplicates" value={duplicateItems.length} />
            <SettingRow label="Invalid" value={invalidItems.length} />
            {createdMode && (
              <p className="mt-4 rounded border border-white/10 bg-white/5 p-3 text-[var(--heading)]">
                Restore complete. Created titles are listed separately; duplicates and invalid items were skipped.
              </p>
            )}
            <label className="mt-4 flex items-start gap-3 text-[var(--heading)]">
              <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} />
              <span>I understand this will merge only new titles into my library and skip duplicates.</span>
            </label>
            <button className="command mt-4 w-full" type="button" disabled={!canRestore} onClick={onRestore}>
              {restoring ? 'Restoring...' : 'Restore backup'}
            </button>
            <div className="mt-4 space-y-4">
              <PreviewList
                title={createLabel}
                emptyText={createEmpty}
                items={createItems.slice(0, 8).map((item, index) => ({
                  key: `${item.title}-${index}`,
                  text: `${createPrefix}: ${item.title} / ${item.status}`,
                }))}
              />
              <PreviewList
                title="Duplicates skipped"
                emptyText="No duplicates found."
                items={duplicateItems.slice(0, 8).map((item, index) => ({
                  key: `${item.title}-${index}`,
                  text: `Duplicate: ${item.title} / ${item.status}`,
                }))}
              />
              <PreviewList
                title="Invalid items"
                emptyText="No invalid items found."
                items={invalidItems.slice(0, 8).map((item, index) => ({
                  key: `${item.title || 'untitled'}-${index}`,
                  text: `Invalid: ${item.title || 'Untitled'} / ${item.reason}`,
                }))}
              />
            </div>
          </>
        ) : (
          <p>No backup preview loaded.</p>
        )}
      </div>
    </div>
  )
}

function PreviewList({ title, emptyText, items }) {
  return (
    <section className="rounded border border-white/10 bg-white/5 p-3">
      <h4 className="text-sm font-semibold text-[var(--heading)]">{title}</h4>
      <div className="import-result-list">
        {items.length ? (
          items.map((item) => <p key={item.key} className="truncate">{item.text}</p>)
        ) : (
          <p>{emptyText}</p>
        )}
      </div>
    </section>
  )
}

function MediaGrid({ items, onComplete, onPatch, onDelete, onSimilar }) {
  if (!items.length) return <EmptyState text="Nothing here yet. Search TMDB or add a custom entry." />
  const groups = groupedMediaItems(items)
  return (
    <div className="media-grid">
      {groups.map((group) => (
        <section key={group.id} className={classNames('media-collection', group.isCollection && 'media-collection-linked')}>
          {group.isCollection && (
            <div className="collection-header">
              <span>{group.name}</span>
              <b>{group.items.length} titles</b>
            </div>
          )}
          <div className="collection-items">
            {group.items.map((item) => (
              <MediaCard key={item.id} item={item} onComplete={onComplete} onPatch={onPatch} onDelete={onDelete} onSimilar={onSimilar} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MediaCard({ item, onComplete, onPatch, onDelete, onSimilar }) {
  const [editingTags, setEditingTags] = useState((item.tags || []).join(', '))
  const [reminder, setReminder] = useState(item.reminder_at?.slice(0, 16) || '')
  const [showReminder, setShowReminder] = useState(Boolean(item.reminder_at))

  return (
    <article className="group media-card">
      <div className="relative aspect-[2/3] overflow-hidden rounded bg-zinc-900">
        <img className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={item.cover_art || fallbackPoster} alt="" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent opacity-90" />
        <div className="absolute bottom-0 p-4">
          <span className="pill">{item.type}</span>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">{item.title}</h2>
          <p className="mt-1 text-sm text-white/70">{item.release_year || 'No year'} / {item.runtime || 45} min</p>
        </div>
        <div className="preview-popover">
          <p className="text-sm leading-6">{item.description || 'No description saved.'}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-amber-300">{(item.genres || []).join(' / ') || 'No genres'}</p>
          <p className="mt-2 text-sm">TMDB {item.tmdb_rating || 'n/a'} / {item.release_year || 'unknown'}</p>
        </div>
      </div>
      <div className="card-controls">
        <div className="card-action-row">
          <Select value={item.status} onChange={(status) => (status === 'Watched' ? onComplete(item) : onPatch(item.id, { ...item, status }))} options={tabs} />
          <button className="icon-button" title="Similar to this" onClick={() => onSimilar(item)}><Sparkles className="h-4 w-4" /></button>
          <button className="icon-button" title="Delete" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4" /></button>
        </div>
        {item.status !== 'Watched' && (
          showReminder ? (
            <div className="reminder-row">
              <input className="field compact-date" type="datetime-local" value={reminder} onChange={(event) => setReminder(event.target.value)} />
              <button className="icon-button" title="Save reminder" onClick={() => onPatch(item.id, { ...item, reminder_at: reminder ? new Date(reminder).toISOString() : null })}>
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button className="secondary-command" onClick={() => setShowReminder(true)}>
              <Bell className="h-4 w-4" />
              Set reminder
            </button>
          )
        )}
        <div className="flex gap-2">
          <input className="field" value={editingTags} onChange={(event) => setEditingTags(event.target.value)} placeholder="tags, genres" />
          <button className="icon-button" title="Save tags" onClick={() => onPatch(item.id, { ...item, tags: editingTags.split(',').map((tag) => tag.trim()).filter(Boolean) })}>
            <Tags className="h-4 w-4" />
          </button>
        </div>
        {item.status !== 'Watched' && <button className="command w-full" onClick={() => onComplete(item)}>Mark completed</button>}
        {item.status === 'Watched' && (
          <p className="rounded border border-white/10 bg-white/5 p-3 text-sm leading-6 text-[var(--muted)]">
            <Star className="mr-1 inline h-4 w-4 text-amber-300" /> {item.personal_rating || 'n/a'} / {item.reflection || 'No reflection yet.'}
          </p>
        )}
      </div>
    </article>
  )
}

function CompletionModal({ draft, setDraft, onClose, onSubmit }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="frosted w-full max-w-xl p-6 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Completion memory</p>
        <h2 className="mt-2 text-3xl font-semibold text-[var(--heading)]">{draft.title}</h2>
        <label className="mt-5 block">
          <span className="text-sm text-[var(--muted)]">Personal rating</span>
          <input className="field mt-2" type="number" min="1" max="10" value={draft.personal_rating || ''} onChange={(event) => setDraft({ ...draft, personal_rating: Number(event.target.value) })} required />
        </label>
        <label className="mt-4 block">
          <span className="text-sm text-[var(--muted)]">Reflection</span>
          <textarea className="field mt-2 min-h-28" value={draft.reflection} onChange={(event) => setDraft({ ...draft, reflection: event.target.value })} placeholder="One or two sentences about what stayed with you." required />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="mini-button" onClick={onClose}>Cancel</button>
          <button className="command" type="submit"><Check className="h-4 w-4" /> Save memory</button>
        </div>
      </form>
    </div>
  )
}

function StatsDashboard({ stats }) {
  if (!stats) return <EmptyState text="Loading stats..." />
  const tiles = [
    ['Watched', stats.watched],
    ['Hours', stats.hours],
    ['Completion', `${stats.completionRate}%`],
    ['Avg rating', stats.averageRating || 'n/a'],
  ]
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <article key={label} className="frosted p-5">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--heading)]">{value}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <SectionTitle icon={BarChart3} title="Monthly activity" kicker="Completed entries" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }} />
                <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <SectionTitle icon={Star} title="Year in Review" kicker="Top completions" />
          <div className="space-y-3">
            {stats.yearReview.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded border border-white/10 bg-white/5 p-2">
                <img className="h-16 w-11 rounded object-cover" src={item.cover_art || fallbackPoster} alt="" />
                <div>
                  <p className="font-medium text-[var(--heading)]">{item.title}</p>
                  <p className="text-sm text-[var(--muted)]">{item.personal_rating || 'n/a'} / 10</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {stats.favoriteGenres.map(([genre, count]) => <span className="pill" key={genre}>{genre} {count}</span>)}
          </div>
        </Panel>
      </div>
    </>
  )
}

function TimelineItem({ item }) {
  return (
    <article className="frosted grid gap-4 p-4 md:grid-cols-[90px_1fr_auto] md:items-center">
      <img className="h-32 w-22 rounded object-cover md:h-32 md:w-22" src={item.cover_art || fallbackPoster} alt="" />
      <div>
        <p className="text-sm text-amber-300">{new Date(item.completed_at).toLocaleDateString()}</p>
        <h2 className="text-2xl font-semibold text-[var(--heading)]">{item.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.reflection || 'No reflection saved.'}</p>
      </div>
      <span className="pill"><Star className="h-3 w-3" /> {item.personal_rating || 'n/a'}</span>
    </article>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium text-[var(--heading)]">{value}</span>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="grid min-h-48 place-items-center rounded border border-dashed border-white/15 bg-white/4 p-8 text-center text-[var(--muted)]">
      <div>
        <Clock className="mx-auto mb-3 h-6 w-6 text-amber-300" />
        {text}
      </div>
    </div>
  )
}

export default App
