# FrameLog Personal Media Tracker

A full-stack local media tracker for movies, TV, anime, and custom entries. The app uses React, Tailwind CSS, Express, SQLite, TMDB metadata, and Gemini recommendations.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Rename `.env.example` to `.env` and fill in your keys:

   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   TMDB_API_KEY=your_tmdb_api_key_here
   PORT=3000
   GEMINI_MODEL=gemini-2.5-flash-lite
   GEMINI_MODEL_FALLBACKS=gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview,gemma-4-26b-a4b-it
   GEMINI_HTTP_REFERER=http://localhost:5173/
   ```

   A local `.env` file is ignored by Git. The backend reads keys from this file so they are not exposed directly in the browser.
   If your Gemini key has HTTP referrer restrictions, make sure `GEMINI_HTTP_REFERER` matches an allowed referrer for that key.
   If the primary Gemini model hits quota, the backend automatically tries each model in `GEMINI_MODEL_FALLBACKS`.

3. Start the app:

   ```bash
   npm run dev
   ```

   The Express API runs on `http://localhost:3000` and Vite serves the React app on `http://localhost:5173`.

## Scripts

- `npm run dev` starts the backend and frontend together.
- `npm run server` starts only the Express API with nodemon.
- `npm run client` starts only Vite.
- `npm run build` builds the frontend.
- `npm run lint` runs ESLint.
- `npm start` starts the API without nodemon.

## Features

- Add media through TMDB title search with poster, description, genre, runtime, year, and rating data.
- Add offline custom media entries.
- Import a PDF watchlist: the backend extracts PDF text, Gemini interprets the titles, TMDB enriches matches, and SQLite saves the created list.
- Track Watched, Want to Watch, and Want to Rewatch lists.
- Store title, type, cover art, genre tags, status, priority, rating, reflection, progress, and reminders.
- Prompt for a short reflection and rating when marking media as Watched.
- Track season and episode progress for TV shows and anime.
- Edit tags manually from each media card.
- Filter lists in real time by title, tag, type, or status.
- Show cinematic hover previews on media cards.
- Request Gemini recommendations: personalized, trending, mood-based, and similar-to-this.
- View stats for watched totals, estimated hours, genres, completion rate, average rating, monthly activity, and Year in Review.
- Browse a chronological watched timeline with year and type filters.
- Set browser notification reminders on Want to Watch entries.
- Toggle dark and light themes.

## Local Data

SQLite data is stored at `data/media.sqlite`. The app is single-user and fully local except for TMDB metadata requests and Gemini recommendation calls.
