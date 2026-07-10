const libraryNormalizationMigrationKey = 'maintenance.library-normalization.v1'

function runLibraryNormalizationMigration({ db, normalizeLibrary, completedAt = new Date().toISOString() }) {
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(libraryNormalizationMigrationKey)
  if (existing) return false

  normalizeLibrary()
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(libraryNormalizationMigrationKey, JSON.stringify({ completed_at: completedAt }))
  return true
}

export { libraryNormalizationMigrationKey, runLibraryNormalizationMigration }
