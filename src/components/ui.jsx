import { Clock } from 'lucide-react'
import { classNames } from '../lib/ui.js'

function Panel({ children, className = '' }) {
  return <div className={classNames('frosted p-5', className)}>{children}</div>
}

function SectionTitle({ icon: Icon, title, kicker }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{kicker}</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-[var(--heading)]">
          <Icon className="h-4 w-4 text-amber-300" />
          {title}
        </h2>
      </div>
    </div>
  )
}

function PageIntro({ kicker, title, copy }) {
  return (
    <div className="max-w-4xl">
      <p className="text-sm uppercase tracking-[0.26em] text-amber-300">{kicker}</p>
      <h1 className="mt-2 text-4xl font-semibold text-[var(--heading)] md:text-6xl">{title}</h1>
      <p className="mt-4 max-w-2xl leading-7 text-[var(--muted)]">{copy}</p>
    </div>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium text-[var(--heading)]">{value}</span>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="grid min-h-48 place-items-center rounded border border-dashed border-white/15 bg-white/4 p-8 text-center text-[var(--muted)]">
      <div>
        <Clock className="mx-auto mb-3 h-6 w-6 text-amber-300" />
        {text}
      </div>
    </div>
  )
}

export { EmptyState, PageIntro, Panel, SectionTitle, Select, SettingRow }
