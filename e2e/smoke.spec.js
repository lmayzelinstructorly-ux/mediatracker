import { expect, test } from '@playwright/test'
import { mockApi } from './helpers.js'

test('renders the FrameLog app shell', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')

  await expect(page.getByText('FrameLog')).toBeVisible()
  await expect(page.getByText('A private cinema ledger')).toBeVisible()
  await expect(page.getByRole('button', { name: /My Lists/i })).toBeVisible()
})
