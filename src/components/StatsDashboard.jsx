import { BarChart3, Star } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fallbackPoster } from '../lib/media.js'
import { EmptyState, Panel, SectionTitle } from './ui.jsx'

function StatsDashboard({ stats }) {
  if (!stats) return <EmptyState text="Loading stats..." />
  const tiles = [
    ['Watched', stats.watched],
    ['Hours', stats.hours],
    ['Completion', `${stats.completionRate}%`],
    ['Avg rating', stats.averageRating || 'n/a'],
  ]
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <article key={label} className="frosted p-5">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 text-4xl font-semibold text-[var(--heading)]">{value}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <SectionTitle icon={BarChart3} title="Monthly activity" kicker="Completed entries" />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }} />
                <Bar dataKey="count" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <SectionTitle icon={Star} title="Year in Review" kicker="Top completions" />
          <div className="space-y-3">
            {stats.yearReview.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded border border-white/10 bg-white/5 p-2">
                <img className="h-16 w-11 rounded object-cover" src={item.cover_art || fallbackPoster} alt="" />
                <div>
                  <p className="font-medium text-[var(--heading)]">{item.title}</p>
                  <p className="text-sm text-[var(--muted)]">{item.personal_rating || 'n/a'} / 10</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {stats.favoriteGenres.map(([genre, count]) => <span className="pill" key={genre}>{genre} {count}</span>)}
          </div>
        </Panel>
      </div>
    </>
  )
}

export { StatsDashboard }
