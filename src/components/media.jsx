import { useState } from 'react'
import { Bell, Check, Sparkles, Star, Tags, Trash2, Upload } from 'lucide-react'
import { fallbackPoster, groupedMediaItems, tabs, types } from '../lib/media.js'
import { classNames } from '../lib/ui.js'
import { EmptyState, Select } from './ui.jsx'

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

export {
  CompletionModal,
  CustomEntry,
  MediaGrid,
  PdfImportPanel,
  SearchResult,
  TimelineItem,
}
