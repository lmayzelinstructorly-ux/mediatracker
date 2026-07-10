import { TimelineItem } from '../components/media.jsx'
import { EmptyState, PageIntro, Select } from '../components/ui.jsx'
import { types } from '../lib/media.js'

export function TimelinePage({ setTimelineType, setTimelineYear, timeline, timelineType, timelineYear, years }) {
  return (
    <section className="space-y-6">
      <PageIntro kicker="Timeline" title="Every finished title, in order." copy="A chronological feed of watched media with rating, completion date, poster, and reflection note." />
      <div className="flex flex-wrap gap-3">
        <Select value={timelineYear} onChange={setTimelineYear} options={['all', ...years]} />
        <Select value={timelineType} onChange={setTimelineType} options={['all', ...types]} />
      </div>
      <div className="space-y-4">
        {timeline.map((item) => <TimelineItem key={item.id} item={item} />)}
        {!timeline.length && <EmptyState text="No completed entries match this filter." />}
      </div>
    </section>
  )
}
