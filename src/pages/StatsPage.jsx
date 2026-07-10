import { StatsDashboard } from '../components/StatsDashboard.jsx'
import { PageIntro } from '../components/ui.jsx'

export function StatsPage({ stats }) {
  return (
    <section className="space-y-6">
      <PageIntro kicker="Personal stats" title="The shape of your viewing year." copy="A quiet dashboard for completed titles, hours, genre gravity, monthly activity, and your current year in review." />
      <StatsDashboard stats={stats} />
    </section>
  )
}
