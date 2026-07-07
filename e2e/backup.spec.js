import { expect, test } from '@playwright/test'
import { waitForBackend } from './helpers.js'

test('exports, previews, and restores a safe merge backup', async ({ request }) => {
  await waitForBackend(request)

  const suffix = Date.now()
  const existingTitle = `Backup Existing ${suffix}`
  const newTitle = `Backup Created ${suffix}`

  const createExisting = await request.post('/api/media', {
    data: {
      title: existingTitle,
      type: 'custom',
      status: 'Want to Watch',
      tags: ['Backup e2e'],
      genres: [],
    },
  })
  expect(createExisting.ok()).toBe(true)

  const exportResponse = await request.get('/api/backup/export')
  expect(exportResponse.ok()).toBe(true)
  const exported = await exportResponse.json()
  expect(exported.schema).toBe('framelog.backup.v1')
  expect(Array.isArray(exported.media)).toBe(true)

  const backup = {
    schema: 'framelog.backup.v1',
    exported_at: new Date().toISOString(),
    settings: { backupE2e: suffix },
    media: [
      { title: existingTitle, type: 'custom', status: 'Want to Watch' },
      { title: newTitle, type: 'movie', status: 'Watched', genres: ['Drama'], tags: ['Backup e2e'] },
      { title: '   ', type: 'movie' },
    ],
  }

  const previewResponse = await request.post('/api/backup/preview', { data: backup })
  expect(previewResponse.ok()).toBe(true)
  const preview = await previewResponse.json()
  expect(preview).toMatchObject({
    ok: true,
    total: 3,
    willCreate: 1,
  })
  expect(preview.create).toEqual([
    expect.objectContaining({ title: newTitle, type: 'movie', status: 'Watched' }),
  ])
  expect(preview.duplicates).toEqual([
    expect.objectContaining({ title: existingTitle, type: 'custom', status: 'Want to Watch' }),
  ])
  expect(preview.invalid).toEqual([
    expect.objectContaining({ reason: 'Title is required' }),
  ])

  const afterPreviewMedia = await (await request.get('/api/media')).json()
  expect(afterPreviewMedia.some((item) => item.title === newTitle)).toBe(false)

  const restoreResponse = await request.post('/api/backup/restore', {
    data: { backup, mode: 'merge' },
  })
  expect(restoreResponse.ok()).toBe(true)
  const restore = await restoreResponse.json()
  expect(restore.created).toEqual([
    expect.objectContaining({ title: newTitle, type: 'movie', status: 'Watched' }),
  ])
  expect(restore.skipped).toEqual([
    expect.objectContaining({ title: existingTitle, type: 'custom', status: 'Want to Watch' }),
  ])
  expect(restore.invalid).toEqual([
    expect.objectContaining({ reason: 'Title is required' }),
  ])

  const afterRestoreMedia = await (await request.get('/api/media')).json()
  expect(afterRestoreMedia.some((item) => item.title === newTitle)).toBe(true)

  const restoredExport = await (await request.get('/api/backup/export')).json()
  expect(restoredExport.settings.backupE2e).toBe(suffix)
})
