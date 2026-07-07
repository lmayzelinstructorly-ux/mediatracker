import { expect, test } from '@playwright/test'
import { waitForBackend } from './helpers.js'

test('adds a custom media entry through the UI', async ({ page, request }) => {
  await waitForBackend(request)
  await page.goto('/')

  const uniqueTitle = `Playwright Custom Entry ${Date.now()}`
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill(uniqueTitle)
  await page.getByRole('button', { name: 'Add custom media' }).click()

  await expect(page.getByText(uniqueTitle + ' added')).toBeVisible()
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible()
})
