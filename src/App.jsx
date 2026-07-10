import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Clapperboard, Film, Settings, Sparkles } from 'lucide-react'
import { api, uploadApi } from './api/client.js'
import { CompletionModal } from './components/media.jsx'
import { isSameMedia, mediaKey } from './lib/media.js'
import { classNames } from './lib/ui.js'
import { ListsPage } from './pages/ListsPage.jsx'
import { RecommendationsPage } from './pages/RecommendationsPage.jsx'
import { SettingsPage } from './pages/SettingsPage.jsx'
import { StatsPage } from './pages/StatsPage.jsx'
import { TimelinePage } from './pages/TimelinePage.jsx'
import './index.css'

const pages = [
  { id: 'lists', label: 'My Lists', icon: Film },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'timeline', label: 'Timeline', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: Settings },
]

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
                <button key={nav.id} onClick={() => setPage(nav.id)} className={classNames('nav-button', page === nav.id && 'nav-button-active')}>
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
          <ListsPage
            activeTab={activeTab}
            addMedia={addMedia}
            addingKeys={addingKeys}
            beginComplete={beginComplete}
            filter={filter}
            filteredMedia={filteredMedia}
            importPdfWatchlist={importPdfWatchlist}
            loading={loading}
            media={media}
            patchMedia={patchMedia}
            pdfImporting={pdfImporting}
            pdfImportResult={pdfImportResult}
            removeMedia={removeMedia}
            runRecommendations={runRecommendations}
            searchTmdb={searchTmdb}
            selectedSuggestionQuery={selectedSuggestionQuery}
            setActiveTab={setActiveTab}
            setFilter={setFilter}
            setSelectedSuggestionQuery={setSelectedSuggestionQuery}
            setSuggestionsOpen={setSuggestionsOpen}
            setTmdbQuery={setTmdbQuery}
            setTmdbResults={setTmdbResults}
            suggestionsLoading={suggestionsLoading}
            suggestionsOpen={suggestionsOpen}
            tmdbQuery={tmdbQuery}
            tmdbResults={tmdbResults}
            tmdbSuggestions={tmdbSuggestions}
          />
        )}

        {page === 'recommendations' && (
          <RecommendationsPage
            loading={loading}
            mood={mood}
            recommendationMeta={recommendationMeta}
            recommendations={recommendations}
            runRecommendations={runRecommendations}
            setMood={setMood}
          />
        )}

        {page === 'stats' && <StatsPage stats={stats} />}

        {page === 'timeline' && (
          <TimelinePage
            setTimelineType={setTimelineType}
            setTimelineYear={setTimelineYear}
            timeline={timeline}
            timelineType={timelineType}
            timelineYear={timelineYear}
            years={years}
          />
        )}

        {page === 'settings' && (
          <SettingsPage
            backupConfirmed={backupConfirmed}
            backupFileName={backupFileName}
            backupImporting={backupImporting}
            backupPreview={backupPreview}
            backupRestoring={backupRestoring}
            exportBackup={exportBackup}
            health={health}
            notifications={notifications}
            previewBackupFile={previewBackupFile}
            restoreBackup={restoreBackup}
            setBackupConfirmed={setBackupConfirmed}
            setNotifications={setNotifications}
            setTheme={setTheme}
            theme={theme}
          />
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


export default App
