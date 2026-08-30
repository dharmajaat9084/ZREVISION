'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Brain,
  GraduationCap,
  Home,
  LibraryBig,
  Moon,
  Search,
  Settings,
  Sun,
  TrendingUp,
} from 'lucide-react'
import { useApp, type View } from '@/lib/store'
import { cn } from '@/lib/utils'
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { LibraryView } from '@/components/library/library-view'
import { ReviewView } from '@/components/review/review-view'
import { StatsView } from '@/components/stats/stats-view'
import { SearchView } from '@/components/search/search-view'
import { SettingsView } from '@/components/settings/settings-view'
import { ItemViewer } from '@/components/viewer/item-viewer'

const NAV: { view: View; label: string; icon: typeof Home }[] = [
  { view: 'dashboard', label: 'Home', icon: Home },
  { view: 'library', label: 'Library', icon: LibraryBig },
  { view: 'review', label: 'Review', icon: Brain },
  { view: 'stats', label: 'Progress', icon: TrendingUp },
  { view: 'search', label: 'Search', icon: Search },
]

export function AppShell() {
  const hydrated = useApp((s) => s.hydrated)
  const view = useApp((s) => s.view)
  const folderId = useApp((s) => s.folderId)
  const setView = useApp((s) => s.setView)
  const settings = useApp((s) => s.settings)
  const reviews = useApp((s) => s.reviews)
  const saveSettings = useApp((s) => s.saveSettings)
  const init = useApp((s) => s.init)

  /* hydrate from IndexedDB once */
  useEffect(() => {
    init()
  }, [init])

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const dueCount = useMemo(() => {
    void tick
    const now = Date.now()
    return Object.values(reviews).filter((r) => !r.suspended && r.due <= now).length
  }, [reviews, tick])

  /* theme class on <html> */
  useEffect(() => {
    document.documentElement.classList.toggle('night', settings.theme === 'night')
  }, [settings.theme])

  /* reminder notifications (while the app is open) */
  useEffect(() => {
    if (!hydrated || !settings.notificationsEnabled) return
    const check = () => {
      try {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
        const due = Object.values(useApp.getState().reviews).filter((r) => !r.suspended && r.due <= Date.now())
        if (due.length === 0) return
        const [h, m] = settings.reminderTime.split(':').map(Number)
        const reminder = new Date()
        reminder.setHours(h, m, 0, 0)
        const last = settings.lastReminderCheck
        const sameDay = last > 0 && new Date(last).toDateString() === new Date().toDateString()
        if (Date.now() >= reminder.getTime() && !sameDay) {
          try {
            new Notification('StudyNest — time to revise', {
              body: `${due.length} ${due.length === 1 ? 'item is' : 'items are'} due for review today. Keep the streak alive!`,
            })
          } catch {
            /* notifications unavailable */
          }
          useApp.getState().saveSettings({ lastReminderCheck: Date.now() })
        }
      } catch {
        /* safety guard against restricted browser environments */
      }
    }
    check()
    const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [hydrated, settings.notificationsEnabled, settings.reminderTime, settings.lastReminderCheck])

  if (!hydrated) {
    return (
      <div className="paper-grain flex h-dvh flex-col items-center justify-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground sketch ink-shadow">
          <GraduationCap className="size-9" aria-hidden />
        </div>
        <p className="font-display text-3xl">Opening your notebook…</p>
        <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
          everything stays on this device
        </p>
      </div>
    )
  }

  return (
    <div className="paper-grain flex h-dvh overflow-hidden">
      {/* ── desktop sidebar ─────────────────────────────────────── */}
      <DesktopSidebar dueCount={dueCount} />

      {/* ── main column ─────────────────────────────────────────── */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="flex items-center justify-between border-b-2 border-border bg-[var(--sidebar)] px-4 py-2.5 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground sketch">
              <GraduationCap className="size-5" aria-hidden />
            </div>
            <span className="font-display text-2xl leading-none">StudyNest</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('search')}
              aria-label="Search"
              className="flex size-10 items-center justify-center rounded-xl hover:bg-[var(--sidebar-accent)]"
            >
              <Search className="size-5" aria-hidden />
            </button>
            <button
              onClick={() => setView('settings')}
              aria-label="Settings"
              className="flex size-10 items-center justify-center rounded-xl hover:bg-[var(--sidebar-accent)]"
            >
              <Settings className="size-5" aria-hidden />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={view + (view === 'library' ? `-${folderId ?? 'root'}` : '')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 md:pb-10"
            >
              {view === 'dashboard' && <DashboardView />}
              {view === 'library' && <LibraryView />}
              {view === 'review' && <ReviewView />}
              {view === 'stats' && <StatsView />}
              {view === 'search' && <SearchView />}
              {view === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* mobile bottom nav */}
        <nav
          className="flex items-stretch justify-around border-t-2 border-border bg-[var(--sidebar)] pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Main navigation"
        >
          {NAV.map(({ view: v, label, icon: Icon }) => {
            const active = view === v
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-w-14 flex-1 flex-col items-center gap-0.5 py-2.5',
                  active ? 'text-primary' : 'text-foreground/70'
                )}
              >
                <span className="relative">
                  <Icon className="size-5.5" aria-hidden />
                  {v === 'review' && dueCount > 0 && (
                    <span className="absolute -right-2.5 -top-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {dueCount > 99 ? '99+' : dueCount}
                    </span>
                  )}
                </span>
                <span className="font-hand text-sm leading-none">{label}</span>
                {active && <span className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-primary" />}
              </button>
            )
          })}
        </nav>
      </div>

      {/* global item viewer */}
      <ItemViewer />
    </div>
  )
}

function DesktopSidebar({ dueCount }: { dueCount: number }) {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)

  useEffect(() => {
    const read = () => {
      try {
        navigator.storage?.estimate?.().then((e) => {
          if (e && e.usage != null && e.quota != null) setUsage({ used: e.usage, quota: e.quota })
        }).catch(() => {})
      } catch {
        /* storage API unavailable */
      }
    }
    read()
    const t = setInterval(read, 30_000)
    return () => clearInterval(t)
  }, [])

  const pct = usage ? Math.min(100, (usage.used / usage.quota) * 100) : 0
  const mb = usage ? usage.used / 1_048_576 : 0

  return (
    <aside className="binder-holes relative hidden w-60 shrink-0 flex-col border-r-2 border-border bg-[var(--sidebar)] pr-6 md:flex">
      {/* logo */}
      <div className="flex items-center gap-3 px-5 pb-2 pt-6">
        <div className="flex size-11 rotate-[-4deg] items-center justify-center rounded-2xl bg-primary text-primary-foreground sketch ink-shadow">
          <GraduationCap className="size-6" aria-hidden />
        </div>
        <div>
          <p className="font-display text-[28px] leading-none">StudyNest</p>
          <p className="font-hand text-[15px] leading-tight" style={{ color: 'var(--ink-soft)' }}>
            my study notebook
          </p>
        </div>
      </div>

      <hr className="doodle-sep mx-5 my-3" />

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-1.5 px-4" aria-label="Main navigation">
        {NAV.map(({ view: v, label, icon: Icon }) => {
          const active = view === v
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left transition-all',
                active
                  ? 'border-border bg-card ink-shadow-sm rotate-[-0.6deg] text-foreground'
                  : 'border-transparent text-foreground/75 hover:rotate-[-0.4deg] hover:bg-[var(--sidebar-accent)] hover:text-foreground'
              )}
            >
              <Icon
                className={cn('size-5 shrink-0', active ? 'text-primary' : 'text-foreground/60 group-hover:text-foreground')}
                aria-hidden
              />
              <span className="font-hand text-[17px] leading-none">{label}</span>
              {v === 'review' && dueCount > 0 && (
                <span className="ml-auto flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-primary/30 bg-primary px-1.5 font-sans text-xs font-bold text-primary-foreground">
                  {dueCount > 99 ? '99+' : dueCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* footer: storage + theme + settings */}
      <div className="space-y-3 px-5 pb-6">
        <button
          onClick={() => setView('settings')}
          aria-current={view === 'settings' ? 'page' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 font-hand text-[17px] transition-all',
            view === 'settings'
              ? 'border-border bg-card ink-shadow-sm rotate-[-0.6deg]'
              : 'border-transparent text-foreground/75 hover:bg-[var(--sidebar-accent)] hover:text-foreground'
          )}
        >
          <Settings className={cn('size-5 shrink-0', view === 'settings' ? 'text-primary' : 'text-foreground/60')} aria-hidden />
          Settings
        </button>
        {usage && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-hand text-[15px]" style={{ color: 'var(--ink-soft)' }}>
                Notebook storage
              </span>
              <span className="font-sans text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>
                {mb < 1 ? `${Math.round(usage.used / 1024)} KB` : `${mb.toFixed(1)} MB`}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full border border-border bg-card">
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>
        )}
        <button
          onClick={() => saveSettings({ theme: settings.theme === 'night' ? 'paper' : 'night' })}
          className="flex w-full items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3.5 py-2 font-hand text-[16px] ink-shadow-sm transition-transform hover:rotate-[-0.5deg]"
          aria-label="Toggle day and night desk theme"
        >
          {settings.theme === 'night' ? <Moon className="size-4.5" aria-hidden /> : <Sun className="size-4.5" aria-hidden />}
          {settings.theme === 'night' ? 'Night desk' : 'Daylight desk'}
        </button>
        <p className="text-center font-sans text-[11px]" style={{ color: 'var(--ink-faint)' }}>
          private · offline · your device only
        </p>
      </div>
    </aside>
  )
}
