import { expect, test } from '@playwright/test'
import { waitForBackend } from './helpers.js'

test('previews and restores a backup through the Settings UI', async ({ page, request }) => {
  await waitForBackend(request)

  const suffix = Date.now()
  const existingTitle = `UI Backup Existing ${suffix}`
  const newTitle = `UI Backup Created ${suffix}`

  const createExisting = await request.post('/api/media', {
    data: {
      title: existingTitle,
      type: 'custom',
      status: 'Want to Watch',
      tags: ['Backup UI e2e'],
      genres: [],
    },
  })
  expect(createExisting.ok()).toBe(true)

  await page.goto('/')
  await page.getByRole('button', { name: /Settings/ }).click()

  await expect(page.getByRole('heading', { name: 'Backup and restore' })).toBeVisible()

  const backup = {
    schema: 'framelog.backup.v1',
    exported_at: new Date().toISOString(),
    media: [
      { title: existingTitle, type: 'custom', status: 'Want to Watch' },
      { title: newTitle, type: 'custom', status: 'Want to Watch', tags: ['Backup UI e2e'] },
      { title: '   ', type: 'movie', status: 'Watched' },
    ],
  }

  await page.setInputFiles('input[name="backupFile"]', {
    name: 'ui-backup-restore.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })

  await expect(page.getByText('Total items').first()).toBeVisible()
  await expect(page.getByText('Will create').first()).toBeVisible()
  await expect(page.getByText('Duplicates').first()).toBeVisible()
  await expect(page.getByText('Invalid').first()).toBeVisible()
  await expect(page.getByText(`Create: ${newTitle} / Want to Watch`)).toBeVisible()
  await expect(page.getByText(`Duplicate: ${existingTitle} / Want to Watch`)).toBeVisible()
  await expect(page.getByText('Invalid: Untitled / Title is required')).toBeVisible()

  const restoreButton = page.getByRole('button', { name: 'Restore backup' })
  await expect(restoreButton).toBeDisabled()

  await page.getByLabel('I understand this will merge only new titles into my library and skip duplicates.').check()
  await restoreButton.click()

  await expect(page.getByText('Restore complete.')).toBeVisible()
  await expect(page.getByText(`Created: ${newTitle} / Want to Watch`)).toBeVisible()

  await page.getByRole('button', { name: /My Lists/ }).click()
  await expect(page.getByRole('heading', { name: newTitle })).toBeVisible()
})
