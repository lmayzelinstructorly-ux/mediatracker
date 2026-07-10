# AI-assisted development rules

Use these rules for every automated or AI-assisted change to FrameLog.

## Keep the scope clear

- FrameLog is a local, single-user media tracker.
- Do not add accounts, cloud storage, analytics, or deployment infrastructure unless the task explicitly requires them.
- Preserve existing user data and backup compatibility.

## Keep the code understandable

- Prefer a small named function over repeated inline logic.
- Do not add another implementation when a helper or service already handles the same job.
- Put external API logic in `server/services/`, database setup in `server/db.js`, and backup logic in `server/backup.js`.
- Avoid adding more unrelated responsibilities to `src/App.jsx` or `server/index.js`. Extract a focused module when new code is reusable or substantial.
- Use descriptive names. Do not leave placeholder names, unexplained constants, commented-out code, generated tutorial text, or fake TODO comments.
- Remove files, imports, dependencies, and styles that become unused.

## Protect secrets and local data

- Never commit `.env`, API keys, access tokens, or SQLite database files.
- Keep TMDB and Gemini calls on the backend.
- End-to-end tests must use `data/e2e-test.sqlite`, never `data/media.sqlite`.

## Verify every change

- Run `npm run check` for all code changes.
- Run `npm run test:e2e` for changes to user flows, API routes, database behavior, imports, backups, or recommendations.
- Add or update tests when behavior changes.
- Do not weaken tests or lint rules merely to make a change pass.

## Keep changes focused

- One pull request should solve one clear problem.
- Explain what changed, why it changed, and how it was verified.
- Avoid unrelated redesigns, dependency upgrades, formatting sweeps, and speculative features.
