'use client'

import { useMemo } from 'react'
import { Brain, CalendarDays, ChevronRight, Flame, History, LibraryBig, Play, Sparkles } from 'lucide-react'
import { useApp } from '@/lib/store'
import { ItemIcon } from '@/components/common/icons'
import { formatIntervalCompact } from '@/lib/srs'
import { greeting, relTime } from '@/lib/helpers'
import { CATEGORY_META } from '@/lib/types'

export function DashboardView() {
  const items = useApp((s) => s.items)
  const nodes = useApp((s) => s.nodes)
  const reviews = useApp((s) => s.reviews)
  const logs = useApp((s) => s.logs)
  const recents = useApp((s) => s.recents)
  const startSession = useApp((s) => s.startSession)
  const openItem = useApp((s) => s.openItem)
  const openFolder = useApp((s) => s.openFolder)
  const setView = useApp((s) => s.setView)

  const now = Date.now()
  const withItems = useMemo(
    () =>
      Object.values(reviews)
        .map((r) => ({ r, item: items[r.itemId] }))
        .filter((x) => x.item),
    [reviews, items]
  )
  const dueCount = withItems.filter((x) => !x.r.suspended && x.r.due <= now).length

  const streak = useMemo(() => {
    const days = new Set(logs.map((l) => new Date(l.date).toDateString()))
    let s = 0
    const d = new Date()
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1) // allow today not yet done
    while (days.has(d.toDateString())) {
      s++
      d.setDate(d.getDate() - 1)
    }
    return s
  }, [logs])

  const weekLogs = logs.filter((l) => l.date > now - 7 * 86_400_000)
  const retention = useMemo(() => {
    const recent = logs.filter((l) => l.date > now - 30 * 86_400_000)
    if (recent.length === 0) return null
    const ok = recent.filter((l) => l.rating >= 3).length
    return Math.round((ok / recent.length) * 100)
  }, [logs, now])

  const forecast = useMemo(() => {
    const days: { label: string; count: number }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 7; i++) {
      const start = today.getTime() + i * 86_400_000
      const end = start + 86_400_000
      const count = withItems.filter((x) => !x.r.suspended && x.r.due < end && (i === 0 ? x.r.due <= end : x.r.due >= start)).length
      days.push({
        label: i === 0 ? 'today' : new Date(start).toLocaleDateString(undefined, { weekday: 'short' }),
        count: i === 0 ? withItems.filter((x) => !x.r.suspended && x.r.due <= end).length : count,
      })
    }
    return days
  }, [withItems])
  const maxForecast = Math.max(1, ...forecast.map((f) => f.count))

  const recentItems = recents.map((r) => items[r.id]).filter(Boolean).slice(0, 6)
  const subjects = Object.values(nodes).filter((n) => n.kind === 'subject').slice(0, 6)

  return (
    <div className="space-y-6">
      {/* greeting */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">
            {greeting()}, <span className="text-primary">scholar!</span>
          </h1>
          <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {dueCount > 0 && (
          <button
            onClick={() => startSession()}
            className="flex items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary px-5 py-3 font-hand text-lg text-primary-foreground sketch ink-shadow transition-transform hover:-rotate-1"
          >
            <Play className="size-5" aria-hidden />
            Revise {dueCount} due
          </button>
        )}
      </header>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Brain}
          label="due for revision"
          value={String(dueCount)}
          accent="#c65953"
          hint={dueCount > 0 ? 'tap revise ↑' : 'all fresh 🎉'}
        />
        <StatCard icon={Flame} label="day streak" value={String(streak)} accent="#d98e32" hint={streak > 0 ? 'keep it burning!' : 'revise to start one'} />
        <StatCard icon={History} label="reviews this week" value={String(weekLogs.length)} accent="#4f8f7b" hint="keep the momentum" />
        <StatCard
          icon={Sparkles}
          label="recall rate"
          value={retention === null ? '—' : `${retention}%`}
          accent="#8b6fae"
          hint={retention === null ? 'no reviews yet' : 'last 30 days'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* forecast */}
        <section className="rounded-2xl border-2 border-border bg-card p-4 ink-shadow lg:col-span-2" aria-label="Revision forecast">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">Revision forecast</h2>
            <span className="font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              next 7 days
            </span>
          </div>
          <div className="flex h-32 items-end justify-between gap-2">
            {forecast.map((f, i) => (
              <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
                  {f.count || ''}
                </span>
                <div
                  className="w-full rounded-t-lg border-2 transition-all"
                  style={{
                    height: `${Math.max(4, (f.count / maxForecast) * 100)}%`,
                    background: i === 0 && f.count > 0 ? 'var(--primary)' : 'var(--secondary)',
                    borderColor: 'var(--border)',
                    borderBottomWidth: 0,
                  }}
                />
                <span className="font-hand text-sm">{f.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* continue */}
        <section className="rounded-2xl border-2 border-border bg-card p-4 ink-shadow" aria-label="Recently opened">
          <h2 className="mb-3 font-display text-2xl">Continue reading</h2>
          {recentItems.length === 0 ? (
            <p className="font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
              Nothing opened yet — your recently viewed material shows up here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recentItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openItem(item.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl border-2 border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-secondary/50"
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ background: CATEGORY_META[item.category].color }}
                    >
                      <ItemIcon item={item} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-sans text-sm font-semibold">{item.name}</span>
                      <span className="block font-hand text-xs" style={{ color: 'var(--ink-soft)' }}>
                        {relTime(item.updatedAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* subjects quick access */}
      <section aria-label="Subjects">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Jump into a subject</h2>
          <button
            onClick={() => setView('library')}
            className="flex items-center gap-1 font-hand text-base text-primary hover:underline"
          >
            <LibraryBig className="size-4" aria-hidden /> full library <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        {subjects.length === 0 ? (
          <button
            onClick={() => setView('library')}
            className="w-full rounded-2xl border-2 border-dashed border-border p-5 text-center font-hand text-lg hover:bg-secondary/40"
            style={{ color: 'var(--ink-soft)' }}
          >
            <CalendarDays className="mx-auto mb-1 size-6" aria-hidden />
            Your shelf is waiting — create your first subject in the library
          </button>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjects.map((s) => {
              return (
                <button
                  key={s.id}
                  onClick={() => openFolder(s.id)}
                  className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3.5 py-2 font-hand text-base ink-shadow-sm transition-transform hover:-rotate-1"
                >
                  <span className="size-3 rounded-full" style={{ background: s.color }} aria-hidden />
                  {s.name}
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Brain
  label: string
  value: string
  hint: string
  accent: string
}) {
  return (
    <div className="relative rounded-2xl border-2 border-border bg-card p-4 ink-shadow-sm">
      <div className="flex items-center gap-2" style={{ color: accent }}>
        <Icon className="size-4.5" aria-hidden />
        <span className="font-hand text-[15px] uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
          {label}
        </span>
      </div>
      <p className="font-display text-4xl leading-tight">{value}</p>
      <p className="font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
        {hint}
      </p>
    </div>
  )
}
