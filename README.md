# MediaTracker

MediaTracker is a single-user, local-first tracker for movies, TV shows, anime, and custom media. The React app talks to an Express API, and the API stores the library in a local SQLite database.

The app does not require an account. TMDB supplies media metadata, while Gemini powers recommendations and improves PDF watchlist imports.

## Main features

- Search TMDB and save titles with posters, descriptions, genres, runtimes, years, and ratings.
- Track `Watched`, `Want to Watch`, and `Want to Rewatch` lists.
- Add custom entries that do not exist on TMDB.
- Import watchlists from PDFs.
- Save ratings, reflections, season and episode progress, tags, priorities, and reminders.
- View recommendations, statistics, a watched timeline, and a year-in-review summary.
- Export a JSON backup and restore only missing items without overwriting the current library.

## Requirements

- Node.js 22
- npm
- A TMDB API key or TMDB read access token for metadata search
- A Gemini API key for recommendations and AI-assisted PDF importing

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and add your API credentials.

3. Start the frontend and backend together:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.

The Express API runs at `http://localhost:3000`. Vite forwards browser requests beginning with `/api` to that server.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the React frontend and Express backend in development mode. |
| `npm run dev:client` | Start only the Vite frontend. |
| `npm run dev:server` | Start only the Express backend with automatic restarts. |
| `npm start` | Start only the Express backend without automatic restarts. |
| `npm run check` | Run linting, unit tests, and a production build. |
| `npm test` | Run unit tests. |
| `npm run test:e2e` | Run Playwright end-to-end tests in Chromium. |
| `npm run test:e2e:ui` | Open Playwright's interactive test runner. |
| `npm run build` | Create the production frontend build in `dist/`. |
| `npm run preview` | Preview the production frontend build. |

Run `npm run check` before committing. Use `npm run test:e2e` when a change affects a user flow, an API route, or stored data.

## Project map

```text
src/
  App.jsx              Main React screen, state, and UI components
  index.css            Global styles and Tailwind import
server/
  index.js             Express routes and application coordination
  db.js                SQLite setup and schema
  backup.js            Backup validation, preview, and restore planning
  known-media.js       Known franchises, title cleanup, and collection helpers
  e2e-fixtures.js      Deterministic API fixtures used by Playwright
  services/
    gemini.js           Gemini model selection and recommendation calls
    tmdb.js             TMDB requests and result normalization
    pdf-import.js       PDF extraction, interpretation, enrichment, and import
tests/                  Vitest unit tests
e2e/                    Playwright end-to-end tests
.github/workflows/      GitHub Actions quality checks
```

## Data and external services

The normal database is `data/media.sqlite`. Set `MEDIA_DB_PATH` to use a different file. SQLite files and `.env` are ignored by Git and should never be committed.

End-to-end tests use `data/e2e-test.sqlite`, deterministic TMDB and Gemini fixtures, and a database cleanup step configured by Playwright. Starting the app normally does not touch the test database.

The browser never receives API secrets. TMDB and Gemini requests are made by the Express backend.

## Current scope

MediaTracker is designed as a personal local application. It does not currently provide authentication, cloud synchronization, multiple user accounts, or a hosted production database.

## Before changing the code

Read [`AGENTS.md`](AGENTS.md). It contains the rules for keeping future AI-assisted changes focused, tested, and free of duplicate or unused code.

## Troubleshooting

- Check the Settings page to confirm whether TMDB and Gemini credentials were detected.
- If port `3000` or `5173` is already in use, stop the other process before running `npm run dev`.
- Install the Playwright browser once with `npx playwright install chromium` if end-to-end tests cannot launch Chromium.
- Delete only the test database when resetting tests. Do not delete `data/media.sqlite` unless you intend to erase the personal library.
