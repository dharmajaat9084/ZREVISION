'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Brain,
  BrainCog,
  MoreVertical,
  Move,
  Pencil,
  Play,
  Star,
  Trash2,
} from 'lucide-react'
import { reviewForItem, useApp } from '@/lib/store'
import { CategoryIcon, ItemIcon } from '@/components/common/icons'
import { RenameItemDialog, MoveDialog } from './dialogs'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { CATEGORY_META, type StudyItem } from '@/lib/types'
import { formatBytes, relTime } from '@/lib/helpers'
import { formatIntervalCompact } from '@/lib/srs'
import { blobUrl } from '@/lib/db'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function ItemGrid({ items }: { items: StudyItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <ItemCard key={i.id} item={i} />
      ))}
    </div>
  )
}

function dueStatus(item: StudyItem) {
  const reviews = useApp.getState().reviews
  const rv = reviewForItem(reviews, item.id)
  if (!rv) return null
  if (rv.suspended) return { label: 'Paused', color: 'var(--ink-faint)', icon: BrainCog }
  const now = Date.now()
  if (rv.due <= now) {
    const days = Math.floor((now - rv.due) / 86_400_000)
    return {
      label: days >= 1 ? `${days}d overdue` : 'Due now',
      color: 'var(--margin-red)',
      icon: Brain,
    }
  }
  return { label: `in ${formatIntervalCompact(Math.max(1, Math.ceil((rv.due - now) / 86_400_000)))}`, color: '#4f8f7b', icon: Brain }
}

export function ItemCard({ item }: { item: StudyItem }) {
  const reviews = useApp((s) => s.reviews)
  const items = useApp((s) => s.items)
  const openItem = useApp((s) => s.openItem)
  const touchRecent = useApp((s) => s.touchRecent)
  const addReview = useApp((s) => s.addReview)
  const removeReview = useApp((s) => s.removeReview)
  const reviewNow = useApp((s) => s.reviewNow)
  const startSession = useApp((s) => s.startSession)
  const setView = useApp((s) => s.setView)

  const [renameOpen, setRenameOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const rv = reviewForItem(reviews, item.id)
  const due = useMemo(() => {
    void items
    return dueStatus(item)

  }, [reviews, item])

  const cat = CATEGORY_META[item.category]

  const open = () => {
    openItem(item.id)
    touchRecent(item.id)
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border-2 border-border bg-card ink-shadow-sm ink-shadow-hover'
      )}
      style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}
    >
      {/* preview strip */}
      <button onClick={open} className="relative block w-full" aria-label={`Open ${item.name}`}>
        <Thumb item={item} />
      </button>

      {/* body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 pt-2.5">
        <div className="flex items-start justify-between gap-1.5">
          <button onClick={open} className="min-w-0 flex-1 text-left" aria-label={`Open ${item.name}`}>
            <p className="truncate font-sans text-[15px] font-bold leading-snug">{item.name}</p>
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            {item.starred && <Star className="size-4 fill-[#d9a441] text-[#d9a441]" aria-label="Starred" />}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${item.name}`}
                className="flex size-7 items-center justify-center rounded-lg opacity-60 hover:bg-secondary hover:opacity-100"
              >
                <MoreVertical className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-2 border-border">
                <DropdownMenuItem onClick={open} className="gap-2 font-hand text-base">Open</DropdownMenuItem>
                {rv ? (
                  <>
                    <DropdownMenuItem
                      onClick={async () => {
                        await reviewNow(item.id)
                        startSession()
                        setView('review')
                      }}
                      className="gap-2 font-hand text-base"
                    >
                      <Play className="size-4" aria-hidden /> Revise it now
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => removeReview(item.id)} className="gap-2 font-hand text-base">
                      <BrainCog className="size-4" aria-hidden /> Remove from revision
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      addReview(item.id)
                      toast.success(`“${item.name}” added to your revision plan`)
                    }}
                    className="gap-2 font-hand text-base"
                  >
                    <Brain className="size-4" aria-hidden /> Add to revision
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => useApp.getState().updateItem(item.id, { starred: !item.starred })}
                  className="gap-2 font-hand text-base"
                >
                  <Star className="size-4" aria-hidden /> {item.starred ? 'Unstar' : 'Star'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRenameOpen(true)} className="gap-2 font-hand text-base">
                  <Pencil className="size-4" aria-hidden /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMoveOpen(true)} className="gap-2 font-hand text-base">
                  <Move className="size-4" aria-hidden /> Move
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="gap-2 font-hand text-base text-destructive focus:text-destructive">
                  <Trash2 className="size-4" aria-hidden /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
          {item.kind === 'snapshot' ? 'Snapshot' : item.kind === 'text' ? 'Text note' : item.fileKind.toUpperCase()} ·{' '}
          {item.kind === 'text' ? `${formatBytes(item.size)}` : formatBytes(item.size)} · {relTime(item.createdAt)}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-[11px] font-bold"
            style={{ borderColor: cat.color + '66', background: cat.soft, color: '#5f5227' }}
          >
            <CategoryIcon category={item.category} className="size-3" />
            {cat.label}
          </span>
          {due && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-sans text-[11px] font-bold"
              style={{ borderColor: due.color + '55', color: due.color }}
            >
              <Brain className="size-3" aria-hidden />
              {due.label}
            </span>
          )}
        </div>
      </div>

      <RenameItemDialog open={renameOpen} onOpenChange={setRenameOpen} item={item} />
      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} mode="item" targetId={item.id} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${item.name}”?`}
        description="The material and its revision schedule will be removed from this device. This cannot be undone."
        onConfirm={async () => {
          await useApp.getState().deleteItem(item.id)
          toast.success(`Deleted “${item.name}”`)
        }}
      />
    </div>
  )
}

function Thumb({ item }: { item: StudyItem }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (item.fileKind === 'image' && item.blobKey) {
      blobUrl(item.blobKey).then((u) => alive && setUrl(u)).catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [item.blobKey, item.fileKind])

  if (item.fileKind === 'image' && url) {
    return (
      <div className="h-28 w-full overflow-hidden border-b-2 border-border bg-secondary" style={{ borderColor: CATEGORY_META[item.category].color + '55' }}>
        { }
        <img src={url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
      </div>
    )
  }
  return (
    <div className="flex h-16 w-full items-center gap-3 border-b-2 border-border/60 bg-secondary/40 px-3">
      <div
        className="flex size-10 shrink-0 rotate-[-3deg] items-center justify-center rounded-xl text-white sketch"
        style={{ background: item.kind === 'snapshot' ? '#4f8f7b' : item.kind === 'text' ? '#7d9a4a' : '#c65953' }}
      >
        <ItemIcon item={item} className="size-5" />
      </div>
      <p className="font-hand text-[15px]" style={{ color: 'var(--ink-soft)' }}>
        {item.kind === 'snapshot' ? 'Cropped snapshot' : item.kind === 'text' ? 'Written note' : item.fileKind === 'pdf' ? 'PDF document' : 'Image'}
      </p>
    </div>
  )
}
