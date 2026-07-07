import { expect, test } from '@playwright/test'
import { waitForBackend } from './helpers.js'

test('renders Gemini recommendation fixtures for personalized and mood flows', async ({ page, request }) => {
  await waitForBackend(request)

  const mediaResponse = await request.post('/api/media', {
    data: {
      title: 'Playwright Library Context',
      type: 'movie',
      status: 'Watched',
      genres: ['Science Fiction', 'Mystery'],
      tags: ['e2e recommendations'],
      description: 'Library context for deterministic recommendation coverage.',
      personal_rating: 9,
    },
  })
  expect(mediaResponse.ok()).toBe(true)

  await page.goto('/')
  await page.getByRole('button', { name: 'Recommendations' }).click()

  await page.getByRole('button', { name: 'Personalized' }).click()
  await expect(page.getByRole('heading', { name: 'Fixture Neon Harbor' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fixture Quiet Signal' })).toBeVisible()
  await expect(page.getByText('e2e-gemini-fixture')).toBeVisible()

  await page.getByPlaceholder('dark psychological thriller, cozy anime night, bleak prestige drama').fill('moody sci-fi')
  await page.getByRole('button', { name: 'Get mood picks' }).click()
  await expect(page.getByRole('heading', { name: 'Fixture Neon Harbor' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Fixture Quiet Signal' })).toBeVisible()
})
