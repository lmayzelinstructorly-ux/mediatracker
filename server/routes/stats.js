import { Router } from 'express'
import { mediaRows } from '../media-store.js'

const router = Router()
router.get('/', (_req, res) => {
  const items = mediaRows()
  const watched = items.filter((item) => item.status === 'Watched')
  const byType = watched.reduce((acc, item) => ({ ...acc, [item.type]: (acc[item.type] || 0) + 1 }), {})
  const genreCounts = {}
  const monthly = {}
  watched.forEach((item) => {
    item.genres.forEach((genre) => {
      genreCounts[genre] = (genreCounts[genre] || 0) + 1
    })
    if (item.completed_at) {
      const key = item.completed_at.slice(0, 7)
      monthly[key] = (monthly[key] || 0) + 1
    }
  })
  const ratings = watched.map((item) => item.personal_rating).filter(Boolean)
  const hours = Math.round((watched.reduce((sum, item) => sum + (item.runtime || 45), 0) / 60) * 10) / 10

  res.json({
    total: items.length,
    watched: watched.length,
    byType,
    hours,
    favoriteGenres: Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6),
    completionRate: items.length ? Math.round((watched.length / items.length) * 100) : 0,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0,
    monthly: Object.entries(monthly).sort().map(([month, count]) => ({ month, count })),
    yearReview: watched
      .filter((item) => item.completed_at?.startsWith(String(new Date().getFullYear())))
      .sort((a, b) => (b.personal_rating || 0) - (a.personal_rating || 0))
      .slice(0, 5),
  })
})

export { router as statsRouter }
