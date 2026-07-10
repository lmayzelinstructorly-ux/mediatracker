const mediaIndexesMigration = {
  version: 2,
  name: 'media-indexes',
  up(db) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_media_status_priority_updated
        ON media(status, priority DESC, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_media_type
        ON media(type);

      CREATE INDEX IF NOT EXISTS idx_media_updated_at
        ON media(updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_media_tmdb_type
        ON media(tmdb_id, type)
        WHERE tmdb_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_media_title_type_year
        ON media(lower(trim(title)), type, release_year);
    `)
  },
}

export { mediaIndexesMigration }
