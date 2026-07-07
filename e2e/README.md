# FrameLog Playwright e2e tests

This folder contains a backend-backed Playwright UI test layer for FrameLog.

## What it covers

- App shell rendering
- Adding a custom media entry through the UI
- Uploading a PDF watchlist through the real browser file input
- Exporting, previewing, and safely merge-restoring a JSON backup through the real backend

The PDF test uses Playwright's `setInputFiles()` API. This is intentional. Do not try to click through the native operating-system file picker in an automated browser test, because the agent cannot reliably see or control that dialog.

## Safety model

These tests run the real Vite frontend and Express backend through Playwright's `webServer` command.

The Playwright config sets `MEDIA_DB_PATH=data/e2e-test.sqlite`, so e2e runs use an isolated SQLite database and do not touch `data/media.sqlite`. It also blanks Gemini and TMDB API credentials for the test server, so the suite does not require external API keys. `e2e/global-setup.js` deletes the test database plus its WAL and SHM files before each run; npm also runs that cleanup before `npm run dev`, so the database is removed before the Express process opens it.

## Run

```bash
npm install
npx playwright install chromium
npm run test:e2e
```
