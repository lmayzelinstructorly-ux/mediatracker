import { expect, test } from '@playwright/test'
import { waitForBackend } from './helpers.js'

test('searches TMDB fixtures and adds a result to the queue', async ({ page, request }) => {
  await waitForBackend(request)
  await page.goto('/')

  const title = 'Fixture Galaxy Quest'
  const searchInput = page.getByPlaceholder('Search a movie, show, or anime')

  await searchInput.fill(title)
  await page.getByRole('button', { name: 'Search' }).click()

  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Queue' }).click()

  await expect(page.getByText(`${title} added`)).toBeVisible()
  await expect(page.getByRole('heading', { name: title })).toHaveCount(2)

  const savedButton = page.getByRole('button', { name: 'Saved' })
  await expect(savedButton).toBeVisible()
  await expect(savedButton).toBeDisabled()
})
