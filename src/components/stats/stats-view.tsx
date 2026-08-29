'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Brain, Flame, History, Layers, Sparkles, TrendingUp } from 'lucide-react'
import { descendantIds, useApp } from '@/lib/store'
import { NodeIcon } from '@/components/common/icons'
import { MASTERY_META, masteryOf, type Mastery } from '@/lib/srs'
import { reviewForItem } from '@/lib/store'
import { EmptyState } from '@/components/common/empty-state'

const DAY = 86_400_000

export function StatsView() {
  const logs = useApp((s) => s.logs)
  const reviews = useApp((s) => s.reviews)
  const items = useApp((s) => s.items)
  const nodes = useApp((s) => s.nodes)

  const now = Date.now()

  /* ── overview ─────────────────────────────────────────────────── */
  const streak = useMemo(() => {
    const days = new Set(logs.map((l) => new Date(l.date).toDateString()))
    let s = 0
    const d = new Date()
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
    while (days.has(d.toDateString())) {
      s++
      d.setDate(d.getDate() - 1)
    }
    return s
  }, [logs])

  const retention = useMemo(() => {
    const recent = logs.filter((l) => l.date > now - 30 * DAY)
    if (recent.length === 0) return null
    return Math.round((recent.filter((l) => l.rating >= 3).length / recent.length) * 100)
  }, [logs, now])

  const activeReviews = Object.values(reviews).filter((r) => !r.suspended)
  const avgInterval =
    activeReviews.length === 0
      ? 0
      : activeReviews.reduce((a, r) => a + r.interval, 0) / activeReviews.length

  /* ── reviews per day (30d) ────────────────────────────────────── */
  const daily = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const out: { day: string; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const start = today.getTime() - i * DAY
      const end = start + DAY
      const count = logs.filter((l) => l.date >= start && l.date < end).length
      out.push({
        day: new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        count,
      })
    }
    return out
  }, [logs])

  /* ── rating distribution ──────────────────────────────────────── */
  const ratingData = useMemo(() => {
    const counts = { Again: 0, Hard: 0, Good: 0, Easy: 0 }
    for (const l of logs) {
      if (l.rating === 1) counts.Again++
      if (l.rating === 2) counts.Hard++
      if (l.rating === 3) counts.Good++
      if (l.rating === 4) counts.Easy++
    }
    return [
      { name: 'Again', value: counts.Again, color: '#c65953' },
      { name: 'Hard', value: counts.Hard, color: '#d98e32' },
      { name: 'Good', value: counts.Good, color: '#7d9a4a' },
      { name: 'Easy', value: counts.Easy, color: '#4f8f7b' },
    ].filter((d) => d.value > 0)
  }, [logs])

  /* ── workload forecast (14d) ──────────────────────────────────── */
  const forecast = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const out: { day: string; due: number }[] = []
    for (let i = 0; i < 14; i++) {
      const start = today.getTime() + i * DAY
      const end = start + DAY
      const count = Object.values(reviews).filter(
        (r) => !r.suspended && r.due >= start && (i === 0 ? true : r.due < end)
      ).length
      out.push({
        day: i === 0 ? 'today' : new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        due: i === 0 ? Object.values(reviews).filter((r) => !r.suspended && r.due < end).length : count,
      })
    }
    return out
  }, [reviews])

  /* ── heatmap (last 17 weeks) ──────────────────────────────────── */
  const heatmap = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of logs) {
      const d = new Date(l.date)
      d.setHours(0, 0, 0, 0)
      const key = d.toISOString().slice(0, 10)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // start 16 weeks ago, on Sunday
    const start = new Date(today)
    start.setDate(start.getDate() - 16 * 7)
    start.setDate(start.getDate() - start.getDay())
    const weeks: { date: Date; count: number }[][] = []
    for (let w = 0; w < 17; w++) {
      const week: { date: Date; count: number }[] = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(start)
        day.setDate(start.getDate() + w * 7 + d)
        week.push({ date: day, count: day <= today ? (counts.get(day.toISOString().slice(0, 10)) ?? 0) : -1 })
      }
      weeks.push(week)
    }
    return weeks
  }, [logs])
  const maxHeat = Math.max(1, ...heatmap.flat().map((d) => d.count))

  /* ── per-subject mastery ──────────────────────────────────────── */
  const subjectRows = useMemo(() => {
    return Object.values(nodes)
      .filter((n) => n.kind === 'subject')
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((s) => {
        const ids = [s.id, ...descendantIds(nodes, s.id)]
        const subItems = Object.values(items).filter((i) => ids.includes(i.nodeId))
        const revs = subItems.map((i) => reviewForItem(reviews, i.id)).filter(Boolean)
        const mastery: Record<Mastery, number> = { new: 0, learning: 0, young: 0, mature: 0 }
        for (const r of revs) mastery[masteryOf(r!)]++
        const nextDue = revs.filter((r) => !r!.suspended).sort((a, b) => a!.due - b!.due)[0]
        return { subject: s, itemCount: subItems.length, revCount: revs.length, mastery, nextDue }
      })
  }, [nodes, items, reviews])

  const masteryTotal = useMemo(() => {
    const m: Record<Mastery, number> = { new: 0, learning: 0, young: 0, mature: 0 }
    for (const r of Object.values(reviews)) m[masteryOf(r)]++
    return m
  }, [reviews])
  const masterySum = Math.max(1, Object.values(masteryTotal).reduce((a, b) => a + b, 0))

  if (logs.length === 0 && Object.keys(reviews).length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyState
          icon={TrendingUp}
          title="No progress to show yet"
          hint="Once you add material to your revision plan and start revising, your streaks, recall rate and mastery will paint themselves here."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header />

      {/* overview cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={History} label="total revisions" value={String(logs.length)} />
        <Card icon={Flame} label="day streak" value={String(streak)} />
        <Card icon={Sparkles} label="recall rate" value={retention === null ? '—' : `${retention}%`} />
        <Card icon={Layers} label="avg interval" value={avgInterval < 1 ? '—' : `${avgInterval.toFixed(1)}d`} />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Revisions per day" subtitle="last 30 days" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'var(--ink-soft)', fontFamily: 'var(--font-hand)' }}
                  interval={4}
                  axisLine={{ stroke: 'var(--line)' }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--secondary)' }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '2px solid var(--border)',
                    borderRadius: 12,
                    fontFamily: 'var(--font-hand)',
                    fontSize: 14,
                  }}
                />
                <Bar dataKey="count" name="revised" fill="#c65953" radius={[6, 6, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="How well you recalled" subtitle="all-time ratings">
          {ratingData.length === 0 ? (
            <p className="flex h-56 items-center justify-center font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
              no ratings yet
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ratingData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                    {ratingData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '2px solid var(--border)',
                      borderRadius: 12,
                      fontFamily: 'var(--font-hand)',
                      fontSize: 14,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {ratingData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1 font-hand text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: d.color }} aria-hidden />
                    {d.name} · {d.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Upcoming workload" subtitle="elements due, next 14 days" className="lg:col-span-2">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'var(--ink-soft)', fontFamily: 'var(--font-hand)' }}
                  interval={2}
                  axisLine={{ stroke: 'var(--line)' }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--secondary)' }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '2px solid var(--border)',
                    borderRadius: 12,
                    fontFamily: 'var(--font-hand)',
                    fontSize: 14,
                  }}
                />
                <Bar dataKey="due" name="due" fill="#d98e32" radius={[6, 6, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Mastery mix" subtitle="all revision elements">
          <div className="space-y-2.5 pt-1">
            {(Object.keys(masteryTotal) as Mastery[]).map((m) => (
              <div key={m}>
                <div className="mb-0.5 flex items-center justify-between font-hand text-sm">
                  <span>{MASTERY_META[m].label}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{masteryTotal[m]}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full border border-border bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(masteryTotal[m] / masterySum) * 100}%`, background: MASTERY_META[m].color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* heatmap */}
      <Panel title="Revision diary" subtitle="each square is a day — the darker, the more you revised">
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-[3px]">
            {heatmap.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) => (
                  <div
                    key={di}
                    title={
                      day.count < 0
                        ? ''
                        : `${day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${day.count} revision${day.count === 1 ? '' : 's'}`
                    }
                    className="size-3.5 shrink-0 rounded-[4px] border border-border/50"
                    style={{
                      background:
                        day.count < 0
                          ? 'transparent'
                          : day.count === 0
                            ? 'var(--secondary)'
                            : `color-mix(in srgb, #c65953 ${Math.min(100, 25 + (day.count / maxHeat) * 75)}%, var(--secondary))`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* per-subject table */}
      <Panel title="Subject mastery" subtitle="how each subject is settling in">
        {subjectRows.length === 0 ? (
          <p className="py-4 text-center font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
            create a subject to see its progress
          </p>
        ) : (
          <div className="space-y-2">
            {subjectRows.map((row) => {
              const revSum = Math.max(1, row.revCount)
              return (
                <div key={row.subject.id} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-border bg-card/60 p-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: row.subject.color, borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}
                  >
                    <NodeIcon kind="subject" className="size-4.5" />
                  </span>
                  <div className="min-w-36 flex-1">
                    <p className="font-sans text-sm font-bold">{row.subject.name}</p>
                    <p className="font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
                      {row.itemCount} materials · {row.revCount} in revision
                      {row.nextDue && !row.nextDue.suspended
                        ? ` · next ${row.nextDue.due <= Date.now() ? 'due now' : 'in ' + Math.ceil((row.nextDue.due - Date.now()) / DAY) + 'd'}`
                        : ''}
                    </p>
                  </div>
                  {row.revCount > 0 ? (
                    <div className="flex h-3.5 w-full min-w-40 overflow-hidden rounded-full border border-border sm:w-56">
                      {(Object.keys(row.mastery) as Mastery[]).map((m) =>
                        row.mastery[m] > 0 ? (
                          <div
                            key={m}
                            title={`${MASTERY_META[m].label}: ${row.mastery[m]}`}
                            style={{ width: `${(row.mastery[m] / revSum) * 100}%`, background: MASTERY_META[m].color }}
                          />
                        ) : null
                      )}
                    </div>
                  ) : (
                    <span className="font-hand text-sm" style={{ color: 'var(--ink-faint)' }}>
                      nothing in revision yet
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}

function Header() {
  return (
    <header className="flex items-center gap-3">
      <div className="flex size-12 rotate-[-4deg] items-center justify-center rounded-2xl bg-primary text-primary-foreground sketch ink-shadow">
        <Brain className="size-6" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">My Progress</h1>
        <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
          streaks, recall and mastery — proof of hard work
        </p>
      </div>
    </header>
  )
}

function Card({ icon: Icon, label, value }: { icon: typeof Brain; label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 ink-shadow-sm">
      <div className="flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}>
        <Icon className="size-4" aria-hidden />
        <span className="font-hand text-[15px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-4xl leading-tight">{value}</p>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border-2 border-border bg-card p-4 ink-shadow ${className ?? ''}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-1">
        <h2 className="font-display text-2xl">{title}</h2>
        {subtitle && (
          <span className="font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
