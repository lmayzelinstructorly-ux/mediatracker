import { useEffect, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { api } from '../api/client.js'
import { fallbackPoster } from '../lib/media.js'

function initialQuery(item) {
  return [
    item.title,
    item.release_year,
    item.type && item.type !== 'custom' ? item.type : '',
  ].filter(Boolean).join(' ')
}

export function MediaReviewModal({ item, onClose, onKeepCustom, onResolve }) {
  const [query, setQuery] = useState(() => initialQuery(item))
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadCandidates() {
      try {
        const candidates = await api(`/search/tmdb?q=${encodeURIComponent(initialQuery(item))}`)
        if (active) setResults(candidates)
      } catch (searchError) {
        if (active) setError(searchError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCandidates()
    return () => {
      active = false
    }
  }, [item])

  async function search(event) {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      setResults(await api(`/search/tmdb?q=${encodeURIComponent(query.trim())}`))
    } catch (searchError) {
      setError(searchError.message)
    } finally {
      setLoading(false)
    }
  }

  async function resolve(candidate) {
    setSaving(String(candidate.tmdb_id))
    setError('')
    try {
      await onResolve(item, candidate)
    } catch (saveError) {
      setError(saveError.message)
      setSaving('')
    }
  }

  async function keepCustom() {
    setSaving('custom')
    setError('')
    try {
      await onKeepCustom(item)
    } catch (saveError) {
      setError(saveError.message)
      setSaving('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <section
        aria-label={`Review ${item.title}`}
        aria-modal="true"
        className="frosted max-h-[92vh] w-full max-w-3xl overflow-y-auto p-5 shadow-2xl md:p-7"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-amber-300">Needs review</p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--heading)]">Choose the right media</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Imported as <strong className="text-[var(--heading)]">{item.title}</strong>. Pick a TMDB match or keep it as a custom entry.
            </p>
          </div>
          <button className="icon-button" type="button" title="Close review" onClick={onClose} disabled={Boolean(saving)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="search-row mt-5" onSubmit={search}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Review search" placeholder="Search title, year, movie, show, or anime" />
          <button title="Search review matches" disabled={loading || Boolean(saving)}>
            <Search className="h-4 w-4" />
          </button>
        </form>

        {error && <p className="mt-4 rounded border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        {loading && <p className="mt-5 text-sm text-[var(--muted)]">Finding likely matches...</p>}

        {!loading && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {results.map((candidate) => (
              <article key={`${candidate.tmdb_id}-${candidate.type}`} className="search-result items-start">
                <img className="h-28 w-20 rounded object-cover" src={candidate.cover_art || fallbackPoster} alt="" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-[var(--heading)]">{candidate.title}</h3>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    {candidate.type} / {candidate.release_year || 'unknown'} / TMDB {candidate.tmdb_rating || 'n/a'}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{candidate.description || 'No description available.'}</p>
                  <button
                    className="mini-button mt-3"
                    type="button"
                    disabled={Boolean(saving)}
                    onClick={() => resolve(candidate)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {saving === String(candidate.tmdb_id) ? 'Saving...' : 'Use this match'}
                  </button>
                </div>
              </article>
            ))}
            {!results.length && <p className="text-sm text-[var(--muted)]">No TMDB matches found. Try a different title, year, or media type.</p>}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">Keeping it custom removes the warning without attaching TMDB metadata.</p>
          <button className="secondary-command shrink-0" type="button" disabled={Boolean(saving)} onClick={keepCustom}>
            {saving === 'custom' ? 'Saving...' : 'Keep as custom'}
          </button>
        </div>
      </section>
    </div>
  )
}
