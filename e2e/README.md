# FrameLog Playwright e2e tests

This folder contains a safe Playwright UI test layer for FrameLog.

## What it covers

- App shell rendering
- Adding a custom media entry through the UI
- Uploading a PDF watchlist through the real browser file input

The PDF test uses Playwright's `setInputFiles()` API. This is intentional. Do not try to click through the native operating-system file picker in an automated browser test, because the agent cannot reliably see or control that dialog.

## Safety model

These tests currently mock `/api/*` routes from inside Playwright instead of starting the Express backend. That means they do not read from or write to `data/media.sqlite`.

This is slightly less complete than a full backend e2e test, but it is safe for the current GitHub state because `server/index.js` still opens `data/media.sqlite` directly. Before switching these tests to the real backend, patch the server to respect a `MEDIA_DB_PATH` environment variable and run e2e against a disposable database such as `data/e2e-test.sqlite`.

## Run

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

## Next step

The next best testing PR is to add true backend-backed e2e once the server supports `MEDIA_DB_PATH`. At that point, add a global setup file that deletes `data/e2e-test.sqlite`, `data/e2e-test.sqlite-wal`, and `data/e2e-test.sqlite-shm` before every full run.
