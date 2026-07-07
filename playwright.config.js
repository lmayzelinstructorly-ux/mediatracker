import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    env: {
      MEDIA_DB_PATH: 'data/e2e-test.sqlite',
      PORT: '3000',
      GEMINI_API_KEY: '',
      TMDB_API_KEY: '',
      TMDB_READ_ACCESS_TOKEN: '',
    },
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
