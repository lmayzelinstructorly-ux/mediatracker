import { expect, test } from '@playwright/test'
import { waitForBackend } from './helpers.js'

test('renders the MediaTracker app shell', async ({ page, request }) => {
  await waitForBackend(request)
  await page.goto('/')

  await expect(page.getByText('MediaTracker')).toBeVisible()
  await expect(page.getByText('A private cinema ledger')).toBeVisible()
  await expect(page.getByRole('button', { name: /My Lists/i })).toBeVisible()
})
