import { expect, test } from '@playwright/test'
import { pdfBufferFromText, waitForBackend } from './helpers.js'

test('reviews an unmatched PDF title and applies the selected TMDB match', async ({ page, request }) => {
  await waitForBackend(request)
  await page.goto('/')

  const importedTitle = `Unmatched Review Title ${Date.now()}`
  await page.locator('input[type=file]').setInputFiles({
    name: 'review-watchlist.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBufferFromText(['PLANNING TO WATCH', `- ${importedTitle}`]),
  })
  await page.getByRole('button', { name: 'Import watchlist' }).click()

  await expect(page.getByText('0 matched / 1 need review')).toBeVisible()
  await page.getByRole('button', { name: /Needs Review\s+1/i }).click()
  await expect(page.getByRole('heading', { name: importedTitle })).toBeVisible()
  await page.getByRole('button', { name: 'Review match' }).click()

  const dialog = page.getByRole('dialog', { name: `Review ${importedTitle}` })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Fixture Galaxy Quest' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Use this match' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Nothing here yet. Search TMDB or add a custom entry.')).toBeVisible()
  await page.getByRole('button', { name: /Want to Watch/i }).click()
  await expect(page.getByRole('heading', { name: 'Fixture Galaxy Quest' })).toBeVisible()
  await expect(page.getByText('Needs review')).not.toBeVisible()
})
