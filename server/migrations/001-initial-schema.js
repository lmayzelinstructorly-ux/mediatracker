const initialSchemaMigration = {
  version: 1,
  name: 'initial-schema',
  up(db) {
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
  },
}

export { initialSchemaMigration }
