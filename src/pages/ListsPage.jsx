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
                      key={`suggest-${item.tmdb_id}-${item.title}`}
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
