'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BellRing,
  Database,
  Download,
  Info,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from '@/lib/store'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { formatBytes } from '@/lib/helpers'
import { cn } from '@/lib/utils'

export function SettingsView() {
  const settings = useApp((s) => s.settings)
  const saveSettings = useApp((s) => s.saveSettings)
  const exportBackup = useApp((s) => s.exportBackup)
  const importBackup = useApp((s) => s.importBackup)
  const wipeAll = useApp((s) => s.wipeAll)

  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default')
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    } catch {
      setPerm('unsupported')
    }
    try {
      navigator.storage?.estimate?.().then((e) => {
        if (e && e.usage != null && e.quota != null) setUsage({ used: e.usage, quota: e.quota })
      }).catch(() => {})
    } catch {
      /* storage unavailable */
    }
  }, [])

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      toast.error('This browser does not support notifications')
      return
    }
    const p = await Notification.requestPermission()
    setPerm(p)
    if (p === 'granted') {
      await saveSettings({ notificationsEnabled: true })
      toast.success('Reminders on — we will nudge you at your reminder time')
    } else {
      toast('Permission denied — you can change it in browser settings')
    }
  }

  const doExport = async () => {
    setBusy(true)
    try {
      const blob = await exportBackup()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `studynest-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Backup downloaded — keep it somewhere safe')
    } catch {
      toast.error('Backup failed')
    } finally {
      setBusy(false)
    }
  }

  const doImport = async () => {
    if (!importFile) return
    setBusy(true)
    try {
      await importBackup(importFile)
      toast.success('Notebook restored from backup')
      setImportOpen(false)
      setImportFile(null)
    } catch {
      toast.error('That file could not be read as a StudyNest backup')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex size-12 rotate-[-4deg] items-center justify-center rounded-2xl bg-primary text-primary-foreground sketch ink-shadow">
          <SettingsIcon className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Settings</h1>
          <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
            tune your desk — everything stays on this device
          </p>
        </div>
      </header>

      {/* theme */}
      <Section title="Desk style" icon={Sun}>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: 'paper' as const, label: 'Daylight desk', hint: 'warm paper & ink', icon: Sun },
              { key: 'night' as const, label: 'Night desk', hint: 'for late-night study', icon: Moon },
            ]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => saveSettings({ theme: t.key })}
              aria-pressed={settings.theme === t.key}
              className={cn(
                'flex flex-col items-start gap-1 rounded-2xl border-2 p-4 text-left transition-all',
                settings.theme === t.key ? 'border-primary bg-secondary/60 ink-shadow-sm -rotate-1' : 'border-dashed border-border hover:bg-secondary/40'
              )}
            >
              <t.icon className="size-6 text-primary" aria-hidden />
              <span className="font-hand text-lg leading-none">{t.label}</span>
              <span className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>
                {t.hint}
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* notifications */}
      <Section title="Revision reminders" icon={BellRing}>
        <div className="space-y-3">
          {settings.notificationsEnabled && perm === 'granted' ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border bg-secondary/40 p-3.5">
              <div>
                <p className="font-hand text-lg leading-tight">Reminders are on</p>
                <p className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>
                  a notification pops up at your reminder time if revisions are due (while StudyNest is open)
                </p>
              </div>
              <button
                onClick={() => saveSettings({ notificationsEnabled: false })}
                className="rounded-xl border-2 border-border bg-card px-3.5 py-1.5 font-hand text-base hover:bg-secondary"
              >
                Turn off
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-border p-3.5">
              <div>
                <p className="font-hand text-lg leading-tight">Nudge me when it&apos;s time to revise</p>
                <p className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {perm === 'denied'
                    ? 'notifications are blocked in your browser settings — allow them for this site first'
                    : 'gentle browser reminders while the app is open'}
                </p>
              </div>
              <button
                onClick={enableNotifications}
                disabled={perm === 'denied' || perm === 'unsupported'}
                className="rounded-xl border-2 border-primary/60 bg-primary px-3.5 py-1.5 font-hand text-base text-primary-foreground sketch disabled:opacity-50"
              >
                Enable
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="reminder-time" className="font-hand text-base">
              Remind me at
            </label>
            <input
              id="reminder-time"
              type="time"
              value={settings.reminderTime}
              onChange={(e) => saveSettings({ reminderTime: e.target.value })}
              className="rounded-xl border-2 border-border bg-card px-3 py-1.5 font-sans text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="daily-limit" className="font-hand text-base">
              Max elements per session
            </label>
            <input
              id="daily-limit"
              type="number"
              min={0}
              max={500}
              value={settings.dailyLimit}
              onChange={(e) => saveSettings({ dailyLimit: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })}
              className="w-24 rounded-xl border-2 border-border bg-card px-3 py-1.5 font-sans text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
            <span className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>
              0 = no limit — take the whole pile at once
            </span>
          </div>
        </div>
      </Section>

      {/* backup */}
      <Section title="Backup & restore" icon={Database}>
        <div className="space-y-3">
          <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Your notebook lives entirely in this browser. To move it to another device or keep it safe, export a
            backup file — it contains every folder, note, PDF, image, snapshot and revision schedule.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={doExport}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl border-2 border-primary/60 bg-primary px-4 py-2 font-hand text-base text-primary-foreground sketch ink-shadow-sm disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden /> Export backup
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 font-hand text-base sketch"
            >
              <Upload className="size-4" aria-hidden /> Restore from backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setImportFile(f)
                  setImportOpen(true)
                }
                e.target.value = ''
              }}
            />
          </div>
          {usage && (
            <div className="rounded-xl border-2 border-border bg-secondary/40 p-3">
              <div className="mb-1.5 flex items-center justify-between font-hand text-base">
                <span>storage used</span>
                <span>
                  {formatBytes(usage.used)} of ~{formatBytes(usage.quota)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full border border-border bg-card">
                <div
                  className="h-full rounded-full bg-primary/80"
                  style={{ width: `${Math.max(2, Math.min(100, (usage.used / usage.quota) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* about */}
      <Section title="How this notebook works" icon={Info}>
        <ul className="space-y-2 font-sans text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          <li>
            <b className="text-foreground">Organise:</b> subjects hold chapters, chapters hold topics, topics hold
            subtopics — and you can park a custom folder anywhere inside any of them.
          </li>
          <li>
            <b className="text-foreground">Collect:</b> every folder keeps Notes, Questions and Practice Sheets in
            separate tabs — PDFs, images and written text notes all live side by side.
          </li>
          <li>
            <b className="text-foreground">Snapshot:</b> crop the few lines you keep forgetting out of any PDF or
            image, and revise just those instead of the whole document.
          </li>
          <li>
            <b className="text-foreground">Revise:</b> after each review, tap how well you recalled it (Again · Hard ·
            Good · Easy) — the built-in spaced-repetition scheduler (an SM-2 algorithm, no internet needed) picks the
            perfect next date for you.
          </li>
        </ul>
      </Section>

      {/* danger */}
      <Section title="Danger zone" icon={Trash2}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3.5">
          <div>
            <p className="font-hand text-lg leading-tight">Erase the entire notebook</p>
            <p className="font-sans text-xs" style={{ color: 'var(--ink-soft)' }}>
              every subject, material and revision record gone forever — export a backup first!
            </p>
          </div>
          <button
            onClick={() => setWipeOpen(true)}
            className="flex items-center gap-2 rounded-xl border-2 border-destructive/60 bg-destructive px-4 py-2 font-hand text-base text-white sketch"
          >
            <Trash2 className="size-4" aria-hidden /> Erase everything
          </button>
        </div>
      </Section>

      <ConfirmDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        title="Erase the entire notebook?"
        description="This permanently deletes every subject, folder, material, snapshot and revision record from this device. There is no undo — export a backup first if you might regret this."
        confirmLabel="Erase everything"
        onConfirm={async () => {
          await wipeAll()
          toast.success('Notebook erased — a fresh start')
        }}
      />

      <ConfirmDialog
        open={importOpen}
        onOpenChange={(v) => {
          setImportOpen(v)
          if (!v) setImportFile(null)
        }}
        title="Restore from backup?"
        description={`“${importFile?.name ?? ''}” will replace everything currently in your notebook.`}
        confirmLabel="Replace & restore"
        destructive={false}
        onConfirm={doImport}
      />
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Sun; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-border bg-card p-5 ink-shadow">
      <h2 className="mb-3 flex items-center gap-2 font-display text-2xl">
        <Icon className="size-5 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  )
}
