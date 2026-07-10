import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runSchemaMigrations } from './migrations/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const rootDir = path.resolve(__dirname, '..')
export const dataDir = path.join(rootDir, 'data')

fs.mkdirSync(dataDir, { recursive: true })

const defaultDbPath = path.join(dataDir, 'media.sqlite')
export const configuredDbPath = process.env.MEDIA_DB_PATH
  ? path.resolve(rootDir, process.env.MEDIA_DB_PATH)
  : defaultDbPath

function openDatabase(databasePath = configuredDbPath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const database = new Database(databasePath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  runSchemaMigrations(database)
  return database
}

export const db = openDatabase()

export { openDatabase }
