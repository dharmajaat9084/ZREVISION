'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Brain,
  BrainCog,
  Crop,
  Download,
  ExternalLink,
  FolderOpen,
  Minus,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { pathOf, reviewForItem, useApp } from '@/lib/store'
import { blobUrl } from '@/lib/db'
import { ItemIcon } from '@/components/common/icons'
import { MoveDialog, RenameItemDialog, TextNoteDialog } from '@/components/library/dialogs'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { SnapshotDialog } from '@/components/snapshot/snapshot-dialog'
import { CATEGORY_META } from '@/lib/types'
import { formatIntervalLong } from '@/lib/srs'
import { formatBytes, relTime } from '@/lib/helpers'
import { cn } from '@/lib/utils'

export function ItemViewer() {
  const openItemId = useApp((s) => s.openItemId)
  const items = useApp((s) => s.items)
  const nodes = useApp((s) => s.nodes)
  const reviews = useApp((s) => s.reviews)
  const openItem = useApp((s) => s.openItem)
  const openFolder = useApp((s) => s.openFolder)
  const addReview = useApp((s) => s.addReview)
  const removeReview = useApp((s) => s.removeReview)
  const updateItem = useApp((s) => s.updateItem)
  const reviewNow = useApp((s) => s.reviewNow)
  const startSession = useApp((s) => s.startSession)

  const [url, setUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const item = openItemId ? items[openItemId] : null
  const rv = item ? reviewForItem(reviews, item.id) : undefined
  const path = useMemo(() => (item ? pathOf(nodes, item.nodeId) : []), [nodes, item])

  useEffect(() => {
    let alive = true
    setUrl(null)
    setZoom(1)
    if (item?.blobKey) {
      blobUrl(item.blobKey)
        .then((u) => alive && setUrl(u))
        .catch(() => toast.error('Could not load this file'))
    }
    return () => {
      alive = false
    }
  }, [item?.blobKey, item?.id])

  if (!item) return null
  const cat = CATEGORY_META[item.category]

  const download = () => {
    if (!url) return
    const ext = item.fileKind === 'pdf' ? 'pdf' : item.mime?.split('/')[1]?.split(';')[0] ?? 'png'
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.name}.${ext}`
    a.click()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-0 backdrop-blur-[2px] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Viewing ${item.name}`}
        onClick={(e) => e.target === e.currentTarget && openItem(null)}
      >
        <div className="pop-in flex h-full w-full max-w-6xl flex-col overflow-hidden border-2 border-border bg-card sketch sm:h-[92dvh] sm:rounded-3xl">
          {/* header */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b-2 border-border bg-[var(--sidebar)] px-3 py-2.5 sm:px-5">
            <div
              className="flex size-10 shrink-0 rotate-[-3deg] items-center justify-center rounded-xl text-white sketch"
              style={{ background: item.kind === 'snapshot' ? '#4f8f7b' : item.kind === 'text' ? '#7d9a4a' : '#c65953' }}
            >
              <ItemIcon item={item} className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-base font-bold leading-tight">{item.name}</p>
              <button
                onClick={() => {
                  openFolder(item.nodeId)
                  openItem(null)
                }}
                className="flex max-w-full items-center gap-1 font-hand text-sm hover:underline"
                style={{ color: 'var(--ink-soft)' }}
              >
                <FolderOpen className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{path.map((n) => n.name).join(' / ') || 'Library'}</span>
              </button>
            </div>

            {/* action chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {rv ? (
                <>
                  <button
                    onClick={async () => {
                      await reviewNow(item.id)
                      openItem(null)
                      startSession()
                    }}
                    className="flex items-center gap-1.5 rounded-xl border-2 border-primary/60 bg-primary px-3 py-1.5 font-hand text-[15px] text-primary-foreground ink-shadow-sm"
                  >
                    <Play className="size-4" aria-hidden /> Revise now
                  </button>
                  <button
                    onClick={() => removeReview(item.id)}
                    className="flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 py-1.5 font-hand text-[15px] hover:bg-secondary"
                    title="Remove from revision plan"
                  >
                    <BrainCog className="size-4" aria-hidden /> In plan
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    addReview(item.id)
                    toast.success('Added to your revision plan')
                  }}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-primary/60 bg-card px-3 py-1.5 font-hand text-[15px] ink-shadow-sm hover:bg-secondary"
                >
                  <Brain className="size-4" aria-hidden /> Add to revision
                </button>
              )}

              {item.fileKind !== 'text' && (
                <button
                  onClick={() => setSnapshotOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 py-1.5 font-hand text-[15px] hover:bg-secondary"
                  title="Crop a piece of this as a snapshot revision element"
                >
                  <Crop className="size-4" aria-hidden /> Snapshot
                </button>
              )}
              {item.kind === 'text' && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-border bg-card px-3 py-1.5 font-hand text-[15px] hover:bg-secondary"
                >
                  <Pencil className="size-4" aria-hidden /> Edit
                </button>
              )}
              <IconAction label="Star" onClick={() => updateItem(item.id, { starred: !item.starred })}>
                <Star className={cn('size-4', item.starred && 'fill-[#d9a441] text-[#d9a441]')} aria-hidden />
              </IconAction>
              <IconAction label="Rename" onClick={() => setRenameOpen(true)}>
                <Pencil className="size-4" aria-hidden />
              </IconAction>
              <IconAction label="Download" onClick={download} disabled={!url}>
                <Download className="size-4" aria-hidden />
              </IconAction>
              <IconAction label="Move" onClick={() => setMoveOpen(true)}>
                <FolderOpen className="size-4" aria-hidden />
              </IconAction>
              <IconAction label="Delete" onClick={() => setDeleteOpen(true)} danger>
                <Trash2 className="size-4" aria-hidden />
              </IconAction>
              <IconAction label="Close" onClick={() => openItem(null)}>
                <X className="size-5" aria-hidden />
              </IconAction>
            </div>
          </div>

          {/* revision meta bar */}
          {rv && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-border/60 bg-secondary/40 px-4 py-1.5 font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
              <span>
                ease {rv.ease.toFixed(2)} · {rv.reps} review{rv.reps === 1 ? '' : 's'}
                {rv.lapses > 0 && <> · {rv.lapses} lapse{rv.lapses === 1 ? '' : 's'}</>}
              </span>
              <span>
                next: {rv.due <= Date.now() ? 'due now' : formatIntervalLong(Math.ceil((rv.due - Date.now()) / 86_400_000)) + ' away'}
              </span>
              {rv.lastReviewed && <span>last revised {relTime(rv.lastReviewed)}</span>}
            </div>
          )}

          {/* content */}
          <div className="min-h-0 flex-1 overflow-auto bg-secondary/30 p-3 sm:p-5">
            {item.kind === 'text' ? (
              <article className="margin-line ruled-paper mx-auto max-w-3xl rounded-xl border-2 border-border p-6 pl-16 text-[15px] leading-[31px] sm:p-8 sm:pl-20">
                <h2 className="mb-4 font-display text-3xl" style={{ lineHeight: '38px' }}>
                  <span
                    className="inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 align-middle font-sans text-xs font-bold"
                    style={{ background: cat.soft, color: '#5f5227' }}
                  >
                    {cat.label}
                  </span>
                </h2>
                <p className="whitespace-pre-wrap">{item.textContent || 'This note is empty.'}</p>
              </article>
            ) : item.fileKind === 'pdf' ? (
              url ? (
                <iframe
                  src={url}
                  title={item.name}
                  className="h-full min-h-[60dvh] w-full rounded-xl border-2 border-border bg-white"
                />
              ) : (
                <LoadingFile />
              )
            ) : url ? (
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <IconAction label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
                    <Minus className="size-4" aria-hidden />
                  </IconAction>
                  <span className="font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <IconAction label="Zoom in" onClick={() => setZoom((z) => Math.min(5, z + 0.25))}>
                    <Plus className="size-4" aria-hidden />
                  </IconAction>
                  <button
                    onClick={() => setZoom(1)}
                    className="rounded-lg border-2 border-border bg-card px-2.5 py-1 font-hand text-sm hover:bg-secondary"
                  >
                    fit
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-xl border-2 border-border bg-[repeating-conic-gradient(var(--secondary)_0%_25%,transparent_0%_50%)] bg-[length:24px_24px] p-3">
                  { }
                  <img
                    src={url}
                    alt={item.name}
                    className="h-auto max-h-none origin-top rounded-lg border border-border bg-card shadow-lg"
                    style={{ width: `${zoom * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <LoadingFile />
            )}
          </div>

          {/* footer meta */}
          <div className="flex shrink-0 items-center justify-between border-t-2 border-border bg-[var(--sidebar)] px-4 py-1.5 font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
            <span className="flex items-center gap-2">
              <NotebookPen className="size-3.5" aria-hidden />
              {item.kind === 'snapshot' ? 'Snapshot' : item.kind === 'text' ? 'Text note' : item.fileKind === 'pdf' ? 'PDF' : 'Image'} ·{' '}
              {formatBytes(item.size)}
            </span>
            <span className="flex items-center gap-2">
              added {relTime(item.createdAt)}
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                  open in tab <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* dialogs */}
      {snapshotOpen && <SnapshotDialog item={item} onClose={() => setSnapshotOpen(false)} />}
      <RenameItemDialog open={renameOpen} onOpenChange={setRenameOpen} item={item} />
      <TextNoteDialog open={editOpen} onOpenChange={setEditOpen} nodeId={item.nodeId} editingItem={item} />
      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} mode="item" targetId={item.id} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${item.name}”?`}
        description="This removes the material and its revision schedule from this device."
        onConfirm={async () => {
          await useApp.getState().deleteItem(item.id)
          openItem(null)
          toast.success('Deleted')
        }}
      />
    </>
  )
}

function IconAction({
  label,
  onClick,
  children,
  disabled,
  danger,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex size-9 items-center justify-center rounded-xl border-2 border-border bg-card transition-colors hover:bg-secondary disabled:opacity-40',
        danger && 'hover:border-destructive/50 hover:text-destructive'
      )}
    >
      {children}
    </button>
  )
}

function LoadingFile() {
  return (
    <div className="flex h-full min-h-[50dvh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 size-10 animate-spin rounded-full border-4 border-border border-t-primary" />
        <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
          fetching from your notebook…
        </p>
      </div>
    </div>
  )
}
