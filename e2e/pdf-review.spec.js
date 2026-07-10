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
  await page.getByRole('button', { name: /Needs Review/i }).click()

  const importedCard = page.getByRole('heading', { name: importedTitle }).locator('xpath=ancestor::article')
  await expect(importedCard).toBeVisible()
  await importedCard.getByRole('button', { name: 'Review match' }).click()

  const dialog = page.getByRole('dialog', { name: `Review ${importedTitle}` })
  await expect(dialog).toBeVisible()

  const candidateCard = dialog.getByRole('heading', { name: 'Fixture Review Match' }).locator('xpath=ancestor::article')
  await expect(candidateCard).toBeVisible()
  await candidateCard.getByRole('button', { name: 'Use this match' }).click()

  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('heading', { name: importedTitle })).toHaveCount(0)
  await page.getByRole('button', { name: /Want to Watch/i }).click()

  const resolvedCard = page.getByRole('heading', { name: 'Fixture Review Match' }).locator('xpath=ancestor::article')
  await expect(resolvedCard).toBeVisible()
  await expect(resolvedCard.getByRole('button', { name: 'Review match' })).toHaveCount(0)
})
