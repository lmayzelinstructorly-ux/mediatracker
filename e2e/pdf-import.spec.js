import { expect, test } from '@playwright/test'
import { mockApi, pdfBufferFromText } from './helpers.js'

test('uploads a PDF watchlist through the file input', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')

  await page.locator('input[type=file]').setInputFiles({
    name: 'watchlist.pdf',
    mimeType: 'application/pdf',
    buffer: pdfBufferFromText('PLANNING TO WATCH - Spirited Away'),
  })

  await expect(page.getByText('watchlist.pdf')).toBeVisible()
  await page.getByRole('button', { name: 'Import watchlist' }).click()

  await expect(page.getByText('1 created / 0 skipped')).toBeVisible()
  await expect(page.getByText('2 titles found in PDF')).toBeVisible()
})
