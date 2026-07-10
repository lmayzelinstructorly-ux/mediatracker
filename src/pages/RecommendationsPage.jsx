import { Lightbulb } from 'lucide-react'
import { PageIntro, Panel } from '../components/ui.jsx'

export function RecommendationsPage({ loading, mood, recommendationMeta, recommendations, runRecommendations, setMood }) {
  return (
    <section className="space-y-6">
      <PageIntro kicker="Gemini recommendations" title="Let the queue listen back." copy="Ask for personal, trending, mood-led, or title-adjacent picks. Results stay local until you choose to add them." />
      <Panel>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-3 md:grid-cols-2">
            <button className="command" onClick={() => runRecommendations('personalized', 'Analyze my whole library')}>Personalized</button>
            <button className="command" onClick={() => runRecommendations('trending', 'Culturally popular right now')}>Trending refresh</button>
            <div className="search-row md:col-span-2">
              <input value={mood} onChange={(event) => setMood(event.target.value)} placeholder="dark psychological thriller, cozy anime night, bleak prestige drama" />
              <button title="Get mood picks" aria-label="Get mood picks" onClick={() => runRecommendations('mood', mood)}>
                <Lightbulb className="h-4 w-4" />
              </button>
            </div>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {loading ? 'Thinking...' : `${recommendations.length} suggestions`}
            {recommendationMeta?.model && ` / ${recommendationMeta.model}`}
            {recommendationMeta?.fallbackCount > 0 && ` after ${recommendationMeta.fallbackCount} fallback${recommendationMeta.fallbackCount === 1 ? '' : 's'}`}
          </span>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recommendations.map((item, index) => (
          <article key={`${item.title}-${index}`} className="frosted p-5">
            <div className="mb-5 flex items-center justify-between">
              <span className="pill">{item.type}</span>
              <span className="text-sm text-amber-300">{item.confidence || 70}% match</span>
            </div>
            <h2 className="text-2xl font-semibold text-[var(--heading)]">{item.title}</h2>
            <p className="mt-3 min-h-16 text-sm leading-6 text-[var(--muted)]">{item.reason}</p>
            <p className="mt-4 text-sm text-teal-300">{item.mood}{item.sourceModel && ` / ${item.sourceModel}`}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
