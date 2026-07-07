import { expect, test } from '@playwright/test'
import { mockApi } from './helpers.js'

test('adds a custom media entry through the UI', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')

  const uniqueTitle = 'Playwright Custom Entry'
  await page.getByPlaceholder('Title').fill(uniqueTitle)
  await page.getByRole('button', { name: 'Add custom media' }).click()

  await expect(page.getByText(uniqueTitle + ' added')).toBeVisible()
  await expect(page.getByRole('heading', { name: uniqueTitle })).toBeVisible()
})
