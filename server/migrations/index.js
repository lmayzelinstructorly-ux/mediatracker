import { initialSchemaMigration } from './001-initial-schema.js'
import { mediaIndexesMigration } from './002-media-indexes.js'

const schemaMigrations = [initialSchemaMigration, mediaIndexesMigration]

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)
}

function validateMigrations(migrations) {
  const seenVersions = new Set()
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(`Invalid migration version: ${migration.version}`)
    }
    if (!migration.name || typeof migration.up !== 'function') {
      throw new Error(`Invalid migration ${migration.version}`)
    }
    if (seenVersions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`)
    }
    seenVersions.add(migration.version)
  }
}

function runSchemaMigrations(db, {
  migrations = schemaMigrations,
  appliedAt = () => new Date().toISOString(),
} = {}) {
  validateMigrations(migrations)
  ensureMigrationTable(db)

  const appliedRows = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all()
  const applied = new Map(appliedRows.map((row) => [row.version, row.name]))
  const completed = []

  for (const migration of [...migrations].sort((left, right) => left.version - right.version)) {
    const existingName = applied.get(migration.version)
    if (existingName) {
      if (existingName !== migration.name) {
        throw new Error(`Migration ${migration.version} was recorded as ${existingName}, expected ${migration.name}`)
      }
      continue
    }

    const applyMigration = db.transaction(() => {
      migration.up(db)
      db.prepare(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(migration.version, migration.name, appliedAt())
    })

    applyMigration()
    completed.push(migration.version)
  }

  return completed
}

export {
  ensureMigrationTable,
  runSchemaMigrations,
  schemaMigrations,
}
