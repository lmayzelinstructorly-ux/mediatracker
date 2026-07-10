import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const appPath = path.join(root, 'src/App.jsx')
const serverPath = path.join(root, 'server/index.js')
const appSource = fs.readFileSync(appPath, 'utf8')
const serverSource = fs.readFileSync(serverPath, 'utf8')

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`)
  const end = endMarker ? source.indexOf(endMarker, start) : source.length
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`)
  return source.slice(start, end).trimEnd()
}

function write(relativePath, content) {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${content.trim()}\n`)
}

const apiFunctions = section(appSource, 'async function api', 'function classNames')
write('src/api/client.js', `${apiFunctions}\n\nexport { api, uploadApi }`)

const classNamesFunction = section(appSource, 'function classNames', 'function mediaTypeFamily')
write('src/lib/ui.js', `${classNamesFunction}\n\nexport { classNames }`)

const mediaUtilities = section(appSource, 'function mediaTypeFamily', 'function App()')
write('src/lib/media.js', `
export const tabs = ['Watched', 'Want to Watch', 'Want to Rewatch']
export const types = ['movie', 'show', 'anime', 'custom']
export const fallbackPoster =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=900&q=80'

${mediaUtilities}

export {
  groupedMediaItems,
  isSameMedia,
  mediaKey,
}
`)

const uiComponents = [
  section(appSource, 'function Panel', 'function SearchResult'),
  section(appSource, 'function Select', 'export default App'),
].join('\n\n')
write('src/components/ui.jsx', `
import { Clock } from 'lucide-react'
import { classNames } from '../lib/ui.js'

${uiComponents}

export { EmptyState, PageIntro, Panel, SectionTitle, Select, SettingRow }
`)

const mediaComponents = [
  section(appSource, 'function SearchResult', 'function BackupPanel'),
  section(appSource, 'function MediaGrid', 'function StatsDashboard'),
  section(appSource, 'function TimelineItem', 'function Select'),
].join('\n\n')
write('src/components/media.jsx', `
import { useState } from 'react'
import { Bell, Check, Sparkles, Star, Tags, Trash2, Upload } from 'lucide-react'
import { fallbackPoster, groupedMediaItems, tabs, types } from '../lib/media.js'
import { classNames } from '../lib/ui.js'
import { EmptyState, Select } from './ui.jsx'

${mediaComponents}

export {
  CompletionModal,
  CustomEntry,
  MediaGrid,
  PdfImportPanel,
  SearchResult,
  TimelineItem,
}
`)

const backupComponents = section(appSource, 'function BackupPanel', 'function MediaGrid')
write('src/components/BackupPanel.jsx', `
import { Download, Upload } from 'lucide-react'
import { SettingRow } from './ui.jsx'

${backupComponents}

export { BackupPanel }
`)

const statsComponent = section(appSource, 'function StatsDashboard', 'function TimelineItem')
write('src/components/StatsDashboard.jsx', `
import { BarChart3, Star } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fallbackPoster } from '../lib/media.js'
import { EmptyState, Panel, SectionTitle } from './ui.jsx'

${statsComponent}

export { StatsDashboard }
`)

write('src/pages/ListsPage.jsx', `
import { FileText, Plus, Search } from 'lucide-react'
import { CustomEntry, MediaGrid, PdfImportPanel, SearchResult } from '../components/media.jsx'
import { Panel, SectionTitle } from '../components/ui.jsx'
import { isSameMedia, mediaKey, tabs } from '../lib/media.js'
import { classNames } from '../lib/ui.js'

export function ListsPage({
  activeTab,
  addMedia,
  addingKeys,
  beginComplete,
  filter,
  filteredMedia,
  importPdfWatchlist,
  loading,
  media,
  pdfImporting,
  pdfImportResult,
  removeMedia,
  runRecommendations,
  searchTmdb,
  selectedSuggestionQuery,
  setActiveTab,
  setFilter,
  setSelectedSuggestionQuery,
  setSuggestionsOpen,
  setTmdbQuery,
  setTmdbResults,
  suggestionsLoading,
  suggestionsOpen,
  tmdbQuery,
  tmdbResults,
  tmdbSuggestions,
  patchMedia,
}) {
  return (
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
                      key={\`suggest-\${item.tmdb_id}-\${item.title}\`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSelectedSuggestionQuery(item.title)
                        setTmdbQuery(item.title)
                        setTmdbResults([item])
                        setSuggestionsOpen(false)
                      }}
                    >
                      <img src={item.cover_art} alt="" />
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
                key={\`\${item.tmdb_id}-\${item.title}\`}
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
          <PdfImportPanel importing={pdfImporting} result={pdfImportResult} onImport={importPdfWatchlist} />
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
  )
}
`)

write('src/pages/RecommendationsPage.jsx', `
import { Lightbulb } from 'lucide-react'
import { PageIntro, Panel } from '../components/ui.jsx'

export function RecommendationsPage({ loading, mood, recommendationMeta, recommendations, runRecommendations, setMood }) {
  return (
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
            {loading ? 'Thinking...' : \`\${recommendations.length} suggestions\`}
            {recommendationMeta?.model && \` / \${recommendationMeta.model}\`}
            {recommendationMeta?.fallbackCount > 0 && \` after \${recommendationMeta.fallbackCount} fallback\${recommendationMeta.fallbackCount === 1 ? '' : 's'}\`}
          </span>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recommendations.map((item, index) => (
          <article key={\`\${item.title}-\${index}\`} className="frosted p-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="pill">{item.type}</span>
              <span className="text-sm text-amber-300">{item.confidence || 70}% match</span>
            </div>
            <h2 className="text-2xl font-semibold text-[var(--heading)]">{item.title}</h2>
            <p className="mt-3 min-h-16 text-sm leading-6 text-[var(--muted)]">{item.reason}</p>
            <p className="mt-4 text-sm text-teal-300">{item.mood}{item.sourceModel && \` / \${item.sourceModel}\`}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
`)

write('src/pages/StatsPage.jsx', `
import { StatsDashboard } from '../components/StatsDashboard.jsx'
import { PageIntro } from '../components/ui.jsx'

export function StatsPage({ stats }) {
  return (
    <section className="space-y-6">
      <PageIntro kicker="Personal stats" title="The shape of your viewing year." copy="A quiet dashboard for completed titles, hours, genre gravity, monthly activity, and your current year in review." />
      <StatsDashboard stats={stats} />
    </section>
  )
}
`)

write('src/pages/TimelinePage.jsx', `
import { TimelineItem } from '../components/media.jsx'
import { EmptyState, PageIntro, Select } from '../components/ui.jsx'
import { types } from '../lib/media.js'

export function TimelinePage({ setTimelineType, setTimelineYear, timeline, timelineType, timelineYear, years }) {
  return (
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
  )
}
`)

write('src/pages/SettingsPage.jsx', `
import { Bell, Download, Moon, Settings, Sun } from 'lucide-react'
import { BackupPanel } from '../components/BackupPanel.jsx'
import { PageIntro, Panel, SectionTitle, SettingRow } from '../components/ui.jsx'

export function SettingsPage({
  backupConfirmed,
  backupFileName,
  backupImporting,
  backupPreview,
  backupRestoring,
  exportBackup,
  health,
  notifications,
  previewBackupFile,
  restoreBackup,
  setBackupConfirmed,
  setNotifications,
  setTheme,
  theme,
}) {
  return (
    <section className="space-y-6">
      <PageIntro kicker="Settings" title="Local controls, no account required." copy="Configure app preferences, notification behavior, and confirm whether backend API keys are present." />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <SectionTitle icon={Settings} title="API configuration" kicker="Read from .env" />
          <SettingRow label="Gemini API" value={health?.geminiConfigured ? 'Configured' : 'Missing'} />
          <SettingRow label="TMDB API" value={health?.tmdbConfigured ? 'Configured' : 'Missing'} />
          <p className="mt-4 text-sm text-[var(--muted)]">Keys live in the backend \`.env\` file so the browser never needs to hold them.</p>
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
  )
}
`)

const appFunction = section(appSource, 'function App()', 'function Panel')
const returnIndex = appFunction.lastIndexOf('\n  return (\n')
if (returnIndex < 0) throw new Error('Unable to find App return block')
const appController = appFunction.slice(0, returnIndex)
const newAppReturn = `
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
`

write('src/App.jsx', `
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

${appController}${newAppReturn}

export default App
`)

let mediaStore = section(serverSource, 'function parseJson', 'const { importWatchlistFromPdf }')
mediaStore = mediaStore.replace('\nnormalizeExistingLibrary()\n', '\n')
write('server/media-store.js', `
import { db } from './db.js'
import {
  applyKnownTitleCorrection,
  findKnownCollection,
  knownCollectionForTitle,
  knownCollectionTitle,
  selectedCollectionTitles,
  titleMatchKey,
} from './known-media.js'

${mediaStore}

export {
  bindMediaPayload,
  findExistingMedia,
  insertMedia,
  librarySnapshot,
  mediaIdentityKey,
  mediaRows,
  normalizeExistingLibrary,
  parseJson,
  rowToMedia,
  splitTrailingReleaseYear,
}
`)

write('server/upload.js', `
import multer from 'multer'

export const watchlistUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true)
      return
    }
    cb(new Error('Please upload a PDF file.'))
  },
})
`)

write('server/routes/health.js', `
import { Router } from 'express'
import { geminiModelQueue } from '../services/gemini.js'

export function createHealthRouter({ tmdbConfigured }) {
  const router = Router()
  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      tmdbConfigured,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
      geminiFallbacks: geminiModelQueue(),
    })
  })
  return router
}
`)

write('server/routes/media.js', `
import { Router } from 'express'
import { db } from '../db.js'
import {
  bindMediaPayload,
  insertMedia,
  mediaRows,
  normalizeExistingLibrary,
  rowToMedia,
} from '../media-store.js'

const router = Router()

router.get('/', (_req, res) => {
  normalizeExistingLibrary()
  res.json(mediaRows())
})

router.post('/', (req, res) => {
  try {
    const saved = insertMedia(req.body)
    res.status(saved.duplicate ? 200 : 201).json(saved)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Media not found' })

  const merged = bindMediaPayload({ ...rowToMedia(existing), ...req.body })
  if (merged.status === 'Watched' && !existing.completed_at) merged.completed_at = new Date().toISOString()
  if (merged.status !== 'Watched') {
    merged.completed_at = null
    merged.personal_rating = null
  }

  db.prepare(\`
    UPDATE media SET
      tmdb_id=@tmdb_id, title=@title, type=@type, cover_art=@cover_art, genres=@genres, tags=@tags,
      description=@description, runtime=@runtime, release_year=@release_year, tmdb_rating=@tmdb_rating,
      status=@status, priority=@priority, personal_rating=@personal_rating, reflection=@reflection,
      season=@season, episode=@episode, completed_at=@completed_at, reminder_at=@reminder_at,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  \`).run({ ...merged, id: req.params.id })

  res.json(rowToMedia(db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id)))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM media WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

export { router as mediaRouter }
`)

write('server/routes/search.js', `
import { Router } from 'express'
import { e2eTmdbFixtureResults, useE2eTmdbFixtures } from '../e2e-fixtures.js'
import { applyKnownTitleCorrection } from '../known-media.js'

export function createSearchRouter({ hydrateTmdb, mapTmdbResult, tmdbFetch }) {
  const router = Router()
  router.get('/tmdb', async (req, res) => {
    try {
      const query = applyKnownTitleCorrection(String(req.query.q || '').trim())
      if (!query) return res.json([])
      if (useE2eTmdbFixtures) return res.json(e2eTmdbFixtureResults)
      const data = await tmdbFetch(\`https://api.themoviedb.org/3/search/multi?language=en-US&include_adult=false&query=\${encodeURIComponent(query)}\`)
      const items = (data.results || [])
        .filter((item) => ['movie', 'tv'].includes(item.media_type))
        .slice(0, 8)
        .map((item) => mapTmdbResult(item, item.media_type))
      const hydrated = await Promise.all(items.slice(0, 5).map((item) => hydrateTmdb(item, item.type === 'show' ? 'tv' : 'movie')))
      res.json(hydrated.concat(items.slice(5)))
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  return router
}
`)

write('server/routes/recommendations.js', `
import { Router } from 'express'
import { e2eGeminiFixtureRecommendations, useE2eGeminiFixtures } from '../e2e-fixtures.js'
import { librarySnapshot } from '../media-store.js'
import { geminiRecommendations } from '../services/gemini.js'

const router = Router()
router.post('/', async (req, res) => {
  try {
    const { mode = 'personalized', context = '' } = req.body
    res.json(await geminiRecommendations(mode, context, {
      librarySnapshot,
      useE2eGeminiFixtures,
      e2eGeminiFixtureRecommendations,
    }))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export { router as recommendationsRouter }
`)

write('server/routes/imports.js', `
import { Router } from 'express'

export function createImportRouter({ importWatchlistFromPdf, upload }) {
  const router = Router()
  router.post('/pdf', upload.single('watchlist'), async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'Attach a PDF file named watchlist.' })
      res.json(await importWatchlistFromPdf(req.file.buffer))
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })
  return router
}
`)

write('server/routes/backups.js', `
import { Router } from 'express'
import { backupDuplicateSummary, backupMediaPlan, backupSchema, settingsObject } from '../backup.js'
import { db } from '../db.js'
import { findExistingMedia, insertMedia, mediaIdentityKey, mediaRows, parseJson } from '../media-store.js'

const router = Router()

router.get('/export', (_req, res) => {
  res.json({
    schema: backupSchema,
    exported_at: new Date().toISOString(),
    media: mediaRows(),
    settings: settingsObject(db, parseJson),
  })
})

router.post('/preview', (req, res) => {
  try {
    const plan = backupMediaPlan(req.body, { mediaRows, mediaIdentityKey, findExistingMedia })
    res.json({
      ok: true,
      total: plan.total,
      willCreate: plan.create.length,
      create: plan.create.map(backupDuplicateSummary),
      duplicates: plan.duplicates,
      invalid: plan.invalid,
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/restore', (req, res) => {
  try {
    if (req.body?.mode !== 'merge') return res.status(400).json({ error: 'Only merge restore mode is supported' })

    const plan = backupMediaPlan(req.body.backup, { mediaRows, mediaIdentityKey, findExistingMedia })
    const created = []
    const skipped = [...plan.duplicates]

    for (const item of plan.create) {
      const saved = insertMedia(item)
      if (saved.duplicate) skipped.push(backupDuplicateSummary(saved))
      else created.push(saved)
    }

    if (plan.settings) {
      const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
      Object.entries(plan.settings).forEach(([key, value]) => upsert.run(key, JSON.stringify(value)))
    }

    res.json({ ok: true, created, skipped, invalid: plan.invalid })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export { router as backupRouter }
`)

write('server/routes/stats.js', `
import { Router } from 'express'
import { mediaRows } from '../media-store.js'

const router = Router()
router.get('/', (_req, res) => {
  const items = mediaRows()
  const watched = items.filter((item) => item.status === 'Watched')
  const byType = watched.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {})
  const genreCounts = {}
  const monthly = {}
  watched.forEach((item) => {
    item.genres.forEach((genre) => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1
    })
    if (item.completed_at) {
      const key = item.completed_at.slice(0, 7)
      monthly[key] = (monthly[key] || 0) + 1
    }
  })
  const ratings = watched.map((item) => item.personal_rating).filter(Boolean)
  const hours = Math.round((watched.reduce((sum, item) => sum + (item.runtime || 45), 0) / 60) * 10) / 10

  res.json({
    total: items.length,
    watched: watched.length,
    byType,
    hours,
    favoriteGenres: Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
    completionRate: items.length ? Math.round((watched.length / items.length) * 100) : 0,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0,
    monthly: Object.entries(monthly).sort().map(([month, count]) => ({ month, count })),
    yearReview: watched
      .filter((item) => item.completed_at?.startsWith(String(new Date().getFullYear())))
      .sort((a, b) => (b.personal_rating || 0) - (a.personal_rating || 0))
      .slice(0, 5),
  })
})

export { router as statsRouter }
`)

write('server/routes/settings.js', `
import { Router } from 'express'
import { settingsObject } from '../backup.js'
import { db } from '../db.js'
import { parseJson } from '../media-store.js'
import { geminiModelQueue } from '../services/gemini.js'

export function createSettingsRouter({ tmdbConfigured }) {
  const router = Router()
  router.get('/', (_req, res) => {
    res.json({
      api: {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        tmdbConfigured,
        geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
        geminiFallbacks: geminiModelQueue(),
      },
      preferences: settingsObject(db, parseJson),
    })
  })

  router.post('/', (req, res) => {
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    Object.entries(req.body || {}).forEach(([key, value]) => upsert.run(key, JSON.stringify(value)))
    res.json({ ok: true })
  })
  return router
}
`)

write('server/index.js', `
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { applyKnownTitleCorrection, findKnownCollection, selectedCollectionTitles } from './known-media.js'
import { mediaIdentityKey, mediaRows, normalizeExistingLibrary, insertMedia, splitTrailingReleaseYear } from './media-store.js'
import { backupRouter } from './routes/backups.js'
import { createHealthRouter } from './routes/health.js'
import { createImportRouter } from './routes/imports.js'
import { mediaRouter } from './routes/media.js'
import { recommendationsRouter } from './routes/recommendations.js'
import { createSearchRouter } from './routes/search.js'
import { createSettingsRouter } from './routes/settings.js'
import { statsRouter } from './routes/stats.js'
import { geminiJsonArray } from './services/gemini.js'
import { createPdfImportService } from './services/pdf-import.js'
import { createTmdbService } from './services/tmdb.js'
import { watchlistUpload } from './upload.js'

const app = express()
const PORT = Number(process.env.PORT || 3000)
const tmdbKey = process.env.TMDB_API_KEY
const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN
const tmdbConfigured = Boolean(tmdbKey || tmdbToken)
const tmdb = createTmdbService({
  tmdbKey,
  tmdbToken,
  posterBase: 'https://image.tmdb.org/t/p/w500',
})
const { importWatchlistFromPdf } = createPdfImportService({
  mediaRows,
  mediaIdentityKey,
  insertMedia,
  findBestTmdb: tmdb.findBestTmdb,
  geminiJsonArray,
  applyKnownTitleCorrection,
  findKnownCollection,
  selectedCollectionTitles,
  splitTrailingReleaseYear,
})

normalizeExistingLibrary()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/api/health', createHealthRouter({ tmdbConfigured }))
app.use('/api/media', mediaRouter)
app.use('/api/search', createSearchRouter(tmdb))
app.use('/api/recommendations', recommendationsRouter)
app.use('/api/import', createImportRouter({ importWatchlistFromPdf, upload: watchlistUpload }))
app.use('/api/backup', backupRouter)
app.use('/api/stats', statsRouter)
app.use('/api/settings', createSettingsRouter({ tmdbConfigured }))

app.listen(PORT, () => {
  console.log(\`MediaTracker API listening on http://localhost:\${PORT}\`)
})
`)

fs.rmSync(path.join(root, 'scripts/refactor-app-server.mjs'), { force: true })
fs.rmSync(path.join(root, '.github/workflows/refactor-app-server.yml'), { force: true })
