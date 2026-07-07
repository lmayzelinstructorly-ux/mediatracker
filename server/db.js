import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const rootDir = path.resolve(__dirname, '..')
export const dataDir = path.join(rootDir, 'data')

fs.mkdirSync(dataDir, { recursive: true })

const defaultDbPath = path.join(dataDir, 'media.sqlite')
export const configuredDbPath = process.env.MEDIA_DB_PATH
  ? path.resolve(rootDir, process.env.MEDIA_DB_PATH)
  : defaultDbPath

fs.mkdirSync(path.dirname(configuredDbPath), { recursive: true })

export const db = new Database(configuredDbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdb_id INTEGER,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    cover_art TEXT,
    genres TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    description TEXT,
    runtime INTEGER DEFAULT 0,
    release_year TEXT,
    tmdb_rating REAL,
    status TEXT NOT NULL DEFAULT 'Want to Watch',
    priority INTEGER DEFAULT 0,
    personal_rating INTEGER,
    reflection TEXT,
    season INTEGER DEFAULT 1,
    episode INTEGER DEFAULT 0,
    completed_at TEXT,
    reminder_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)
