'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlarmClockCheck,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Frown,
  Hourglass,
  ListChecks,
  PartyPopper,
  Pause,
  Play,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { reviewForItem, useApp } from '@/lib/store'
import { blobUrl } from '@/lib/db'
import { ItemIcon } from '@/components/common/icons'
import { EmptyState } from '@/components/common/empty-state'
import { formatIntervalCompact, previewIntervals } from '@/lib/srs'
import { CATEGORY_META, type Rating } from '@/lib/types'
import { cn } from '@/lib/utils'
import { relTime } from '@/lib/helpers'

export function ReviewView() {
  const session = useApp((s) => s.session)
  if (session) return <ReviewSession />
  return <ReviewHome />
}

/* ── home: the revision desk ──────────────────────────────────────── */

function ReviewHome() {
  const reviews = useApp((s) => s.reviews)
  const items = useApp((s) => s.items)
  const nodes = useApp((s) => s.nodes)
  const startSession = useApp((s) => s.startSession)
  const setView = useApp((s) => s.setView)
  const openFolder = useApp((s) => s.openFolder)

  const now = Date.now()
  const withItems = useMemo(
    () =>
      Object.values(reviews)
        .map((r) => ({ r, item: items[r.itemId] }))
        .filter((x) => x.item),
    [reviews, items]
  )
  const due = withItems.filter((x) => !x.r.suspended && x.r.due <= now).sort((a, b) => a.r.due - b.r.due)
  const learningSoon = withItems.filter(
    (x) => !x.r.suspended && x.r.due > now && x.r.due <= now + 3_600_000
  )
  const upcoming = withItems
    .filter((x) => !x.r.suspended && x.r.due > now + 3_600_000)
    .sort((a, b) => a.r.due - b.r.due)
    .slice(0, 6)
  const paused = withItems.filter((x) => x.r.suspended)

  if (withItems.length === 0) {
    return (
      <div className="space-y-6">
        <Header title="Revision" subtitle="spaced repetition keeps memories fresh" />
        <EmptyState
          icon={Brain}
          title="No revision elements yet"
          hint="Open any note, PDF, question set or practice sheet in your library and press “Add to revision”. Snapshots of tricky bits count too — StudyNest will then tell you exactly when to revise each one."
          action={
            <button
              onClick={() => setView('library')}
              className="mt-1 flex items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary px-5 py-2.5 font-hand text-lg text-primary-foreground sketch ink-shadow"
            >
              Go to my library <ChevronRight className="size-4" aria-hidden />
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header title="Revision" subtitle="spaced repetition keeps memories fresh" />

      {/* due card */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-card p-5 ink-shadow">
        <span className="tape" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex size-14 items-center justify-center rounded-2xl text-white sketch',
                due.length > 0 ? 'bg-primary wiggle-hover' : 'bg-[#7d9a4a]'
              )}
            >
              {due.length > 0 ? <AlarmClockCheck className="size-7" aria-hidden /> : <CheckCircle2 className="size-7" aria-hidden />}
            </div>
            <div>
              <p className="font-display text-4xl leading-none">
                {due.length === 0 ? 'All caught up!' : `${due.length} due ${due.length === 1 ? 'element' : 'elements'}`}
              </p>
              <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
                {due.length === 0
                  ? 'nothing to revise right now — check back later'
                  : learningSoon.length > 0
                    ? `${learningSoon.length} more coming up within the hour`
                    : 'revise them while they are fresh'}
              </p>
            </div>
          </div>
          <button
            onClick={() => startSession()}
            disabled={due.length === 0 && learningSoon.length === 0}
            className="flex items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary px-5 py-3 font-hand text-lg text-primary-foreground sketch ink-shadow transition-transform hover:-rotate-1 disabled:opacity-50"
          >
            <Play className="size-5" aria-hidden />
            Start revision
          </button>
        </div>
      </div>

      {/* due list */}
      {due.length > 0 && (
        <section className="space-y-2" aria-label="Due now">
          <h2 className="font-display text-2xl">Due now</h2>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {due.slice(0, 10).map(({ r, item }) => {
              const overdueDays = Math.floor((now - r.due) / 86_400_000)
              const folder = nodes[item.nodeId]
              const cat = CATEGORY_META[item.category]
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-3 ink-shadow-sm">
                  <div
                    className="flex size-9 shrink-0 rotate-[-3deg] items-center justify-center rounded-lg text-white sketch"
                    style={{ background: overdueDays >= 1 ? 'var(--margin-red)' : cat.color }}
                  >
                    <ItemIcon item={item} className="size-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-bold">{item.name}</p>
                    <p className="truncate font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
                      {folder?.name} · {cat.label}
                    </p>
                  </div>
                  <span className="shrink-0 font-hand text-sm" style={{ color: overdueDays >= 1 ? 'var(--margin-red)' : 'var(--ink-soft)' }}>
                    {overdueDays >= 1 ? `${overdueDays}d late` : r.due <= now ? 'now' : relTime(r.due)}
                  </span>
                  <button
                    onClick={() => openFolder(item.nodeId)}
                    aria-label={`Go to ${folder?.name}`}
                    className="shrink-0 rounded-lg border-2 border-border bg-card p-1.5 hover:bg-secondary"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
              )
            })}
            {due.length > 10 && (
              <p className="col-span-full font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
                …and {due.length - 10} more
              </p>
            )}
          </div>
        </section>
      )}

      {/* upcoming */}
      <section className="space-y-2" aria-label="Coming up">
        <h2 className="font-display text-2xl">Coming up</h2>
        {upcoming.length === 0 && paused.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-4 font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
            Nothing scheduled ahead — add more material to revision to fill your calendar.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map(({ r, item }) => (
              <div key={r.id} className="flex items-center gap-2.5 rounded-xl border-2 border-border bg-card p-2.5 ink-shadow-sm">
                <ItemIcon item={item} className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-sans text-sm font-semibold">{item.name}</span>
                <span className="flex shrink-0 items-center gap-1 font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
                  <CalendarClock className="size-3.5" aria-hidden />
                  {formatIntervalCompact(Math.max(1, Math.ceil((r.due - now) / 86_400_000)))}
                </span>
              </div>
            ))}
            {paused.slice(0, 3).map(({ item }) => (
              <div key={item.id} className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-border p-2.5 opacity-60">
                <Pause className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-sans text-sm font-semibold">{item.name}</span>
                <span className="font-hand text-sm">paused</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

/* ── active session ───────────────────────────────────────────────── */

function ReviewSession() {
  const session = useApp((s) => s.session)!
  const reviews = useApp((s) => s.reviews)
  const items = useApp((s) => s.items)
  const nodes = useApp((s) => s.nodes)
  const gradeReview = useApp((s) => s.gradeReview)
  const advanceSession = useApp((s) => s.advanceSession)
  const endSession = useApp((s) => s.endSession)
  const postponeReview = useApp((s) => s.postponeReview)

  const shownAt = useRef(Date.now())
  const [url, setUrl] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)

  const queueItems = useMemo(
    () =>
      session.queue
        .map((rid) => ({ review: reviews[rid], item: items[reviews[rid]?.itemId ?? ''] }))
        .filter((x) => x.review && x.item && !x.review.suspended),
    [session.queue, reviews, items]
  )

  const current = queueItems[session.index]
  const done = session.index >= queueItems.length

  useEffect(() => {
    shownAt.current = Date.now()
    setUrl(null)
    if (current?.item.blobKey) {
      blobUrl(current.item.blobKey).then(setUrl).catch(() => {})
    }
  }, [current?.item.id, current?.item.blobKey])

  const rate = async (rating: Rating) => {
    if (!current) return
    const spent = Math.round((Date.now() - shownAt.current) / 1000)
    await gradeReview(current.item.id, rating, spent)
    advanceSession(rating, current.item.id)
  }

  if (done) return <SessionSummary />

  if (!current) {
    return (
      <div className="space-y-6">
        <Header title="Revision" subtitle="spaced repetition keeps memories fresh" />
        <EmptyState
          icon={Hourglass}
          title="Nothing due right now"
          hint="Your schedule is clear — well done! Come back when the next element is due."
          action={
            <button onClick={endSession} className="rounded-xl border-2 border-border bg-card px-5 py-2 font-hand text-lg sketch">
              Back to revision desk
            </button>
          }
        />
      </div>
    )
  }

  const item = current.item
  const review = current.review
  const prev = previewIntervals(review)
  const path = nodes[item.nodeId]
  const progress = (session.index / queueItems.length) * 100

  const buttons: { rating: Rating; label: string; hint: string; color: string; icon: typeof ThumbsUp }[] = [
    { rating: 1, label: 'Again', hint: 'blanked out', color: 'var(--margin-red)', icon: RotateCcw },
    { rating: 2, label: 'Hard', hint: 'struggled', color: '#d98e32', icon: Frown },
    { rating: 3, label: 'Good', hint: 'recalled it', color: '#7d9a4a', icon: ThumbsUp },
    { rating: 4, label: 'Easy', hint: 'instant', color: '#4f8f7b', icon: PartyPopper },
  ]

  return (
    <div className="space-y-4">
      {/* progress */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setExiting(true)
          }}
          className="flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 py-1.5 font-hand text-base hover:bg-secondary"
          aria-label="End revision session"
        >
          <X className="size-4" aria-hidden /> End
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-border bg-card">
          <div className="h-full bg-primary/80 transition-all" style={{ width: `${Math.max(3, progress)}%` }} />
        </div>
        <span className="font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
          {session.index + 1} / {queueItems.length}
        </span>
      </div>

      {/* card */}
      <article className="overflow-hidden rounded-2xl border-2 border-border bg-card ink-shadow">
        <header className="flex flex-wrap items-center gap-2.5 border-b-2 border-border bg-[var(--sidebar)] px-4 py-3">
          <div
            className="flex size-10 shrink-0 rotate-[-3deg] items-center justify-center rounded-xl text-white sketch"
            style={{ background: CATEGORY_META[item.category].color }}
          >
            <ItemIcon item={item} className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-sans text-base font-bold">{item.name}</p>
            <p className="truncate font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              {CATEGORY_META[item.category].label} · {path?.name ?? 'Library'}
              {review.state === 'new' && ' · first revision'}
            </p>
          </div>
          <span className="hidden items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-hand text-sm sm:flex" style={{ color: 'var(--ink-soft)' }}>
            <Clock className="size-3.5" aria-hidden />
            {review.state === 'new' ? 'new' : `seen ${review.reps}×`}
          </span>
          <button
            onClick={async () => {
              await postponeReview(item.id, 1)
              advanceSession(null, item.id)
              toast('Postponed until tomorrow')
            }}
            className="flex items-center gap-1 rounded-xl border-2 border-border bg-card px-2.5 py-1.5 font-hand text-sm hover:bg-secondary"
            title="Not in the mood for this one? Push it to tomorrow"
          >
            <Hourglass className="size-3.5" aria-hidden /> Later
          </button>
        </header>

        {/* content */}
        <div className="max-h-[52dvh] min-h-[240px] overflow-auto bg-secondary/30 p-3 sm:p-4">
          {item.kind === 'text' ? (
            <div className="margin-line ruled-paper mx-auto max-w-2xl rounded-xl border-2 border-border p-5 pl-14 text-[15px] leading-[31px]">
              <p className="whitespace-pre-wrap">{item.textContent}</p>
            </div>
          ) : item.fileKind === 'pdf' ? (
            url ? (
              <iframe src={url} title={item.name} className="h-[48dvh] w-full rounded-xl border-2 border-border bg-white" />
            ) : (
              <div className="flex h-40 items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-4 border-border border-t-primary" />
              </div>
            )
          ) : url ? (
            <div className="flex justify-center">
              { }
              <img src={url} alt={item.name} className="max-h-[46dvh] rounded-xl border-2 border-border bg-card object-contain" />
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center">
              <div className="size-8 animate-spin rounded-full border-4 border-border border-t-primary" />
            </div>
          )}
        </div>

        {/* rating bar */}
        <footer className="border-t-2 border-border bg-[var(--sidebar)] p-3 sm:px-4">
          <p className="mb-2 text-center font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
            how well did you remember it?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {buttons.map((b) => (
              <button
                key={b.rating}
                onClick={() => rate(b.rating)}
                className="flex flex-col items-center gap-0.5 rounded-xl border-2 bg-card px-3 py-2.5 sketch ink-shadow-sm transition-transform hover:-rotate-1 hover:scale-[1.03]"
                style={{ borderColor: b.color }}
              >
                <b.icon className="size-5" style={{ color: b.color }} aria-hidden />
                <span className="font-hand text-lg leading-none">{b.label}</span>
                <span className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {b.hint} · {formatIntervalCompact(prev[b.rating])}
                </span>
              </button>
            ))}
          </div>
        </footer>
      </article>

      {exiting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-border bg-card p-5 sketch pop-in">
            <p className="font-display text-2xl">End this session?</p>
            <p className="mt-1 font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
              You have revised {session.results.length} of {queueItems.length} elements. Remaining ones stay scheduled.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setExiting(false)} className="rounded-xl border-2 border-border bg-card px-4 py-2 font-hand text-base">
                Keep going
              </button>
              <button
                onClick={() => {
                  setExiting(false)
                  endSession()
                }}
                className="rounded-xl border-2 border-destructive/60 bg-destructive px-4 py-2 font-hand text-base text-white sketch"
              >
                End session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionSummary() {
  const session = useApp((s) => s.session)!
  const endSession = useApp((s) => s.endSession)
  const setView = useApp((s) => s.setView)

  const total = session.results.length
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Rating, number>
  for (const r of session.results) counts[r.rating]++
  const mins = Math.max(1, Math.round((Date.now() - session.startedAt) / 60_000))

  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <div className="relative w-full max-w-lg rounded-3xl border-2 border-border bg-card p-8 text-center sketch ink-shadow">
        <span className="tape" aria-hidden />
        <div className="mx-auto mb-4 flex size-16 rotate-[-4deg] items-center justify-center rounded-2xl bg-[#7d9a4a] text-white sketch">
          <ListChecks className="size-8" aria-hidden />
        </div>
        <h2 className="font-display text-4xl">Session done!</h2>
        <p className="mt-1 font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
          {total} {total === 1 ? 'element' : 'elements'} revised in ~{mins} min — nicely done
        </p>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {(
            [
              { r: 1 as Rating, label: 'Again', color: 'var(--margin-red)' },
              { r: 2 as Rating, label: 'Hard', color: '#d98e32' },
              { r: 3 as Rating, label: 'Good', color: '#7d9a4a' },
              { r: 4 as Rating, label: 'Easy', color: '#4f8f7b' },
            ]
          ).map((b) => (
            <div key={b.r} className="rounded-xl border-2 p-3" style={{ borderColor: b.color + '77' }}>
              <p className="font-display text-3xl leading-none" style={{ color: b.color }}>
                {counts[b.r]}
              </p>
              <p className="font-hand text-sm">{b.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              endSession()
              setView('dashboard')
            }}
            className="rounded-xl border-2 border-primary/70 bg-primary px-5 py-2.5 font-hand text-lg text-primary-foreground sketch ink-shadow"
          >
            Back to desk
          </button>
          <button
            onClick={() => {
              endSession()
              setView('stats')
            }}
            className="rounded-xl border-2 border-border bg-card px-5 py-2.5 font-hand text-lg sketch"
          >
            See progress
          </button>
        </div>
      </div>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex items-center gap-3">
      <div className="flex size-12 rotate-[-4deg] items-center justify-center rounded-2xl bg-primary text-primary-foreground sketch ink-shadow">
        <Brain className="size-6" aria-hidden />
      </div>
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
        <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
          {subtitle}
        </p>
      </div>
    </header>
  )
}
