import { Download, Upload } from 'lucide-react'
import { SettingRow } from './ui.jsx'

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

export { BackupPanel }
