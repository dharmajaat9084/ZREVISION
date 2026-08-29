'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownUp,
  Brain,
  FileUp,
  FolderPlus,
  MoreVertical,
  NotebookPen,
  Pencil,
  Palette,
  Plus,
  Trash2,
  Move,
} from 'lucide-react'
import { descendantIds, pathOf, reviewForItem, useApp } from '@/lib/store'
import { NodeIcon } from '@/components/common/icons'
import { Breadcrumbs } from './breadcrumbs'
import { ItemGrid } from './item-grid'
import { CreateNodeDialog, MoveDialog, RenameDialog, TextNoteDialog, UploadDialog } from './dialogs'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { KIND_META, SUGGESTED_CHILD, type ItemCategory, type NodeKind, type StudyNode } from '@/lib/types'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type SortKey = 'newest' | 'oldest' | 'name' | 'size'

export function FolderView({ nodeId }: { nodeId: string }) {
  const nodes = useApp((s) => s.nodes)
  const items = useApp((s) => s.items)
  const reviews = useApp((s) => s.reviews)
  const openFolder = useApp((s) => s.openFolder)

  const node = nodes[nodeId]

  const children = useMemo(
    () => Object.values(nodes).filter((n) => n.parentId === nodeId).sort((a, b) => a.createdAt - b.createdAt),
    [nodes, nodeId]
  )
  const folderItems = useMemo(
    () => Object.values(items).filter((i) => i.nodeId === nodeId),
    [items, nodeId]
  )

  /* dialog state */
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<NodeKind>(SUGGESTED_CHILD[node?.kind ?? 'folder'] ?? 'folder')
  const [uploadFiles, setUploadFiles] = useState<File[] | null>(null)
  const [textOpen, setTextOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [recolorOpen, setRecolorOpen] = useState(false)

  /* items tab + sort */
  const [tab, setTab] = useState<'all' | ItemCategory>('all')
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  /* drag & drop upload */
  const [dragOver, setDragOver] = useState(false)
  const dragCounter = useRef(0)

  const subjectColor = useMemo(() => {
    const path = pathOf(nodes, nodeId)
    return path[0]?.color ?? '#7d9a4a'
  }, [nodes, nodeId])

  const visibleItems = useMemo(() => {
    const list = tab === 'all' ? folderItems : folderItems.filter((i) => i.category === tab)
    const sorted = [...list]
    if (sortKey === 'newest') sorted.sort((a, b) => b.createdAt - a.createdAt)
    if (sortKey === 'oldest') sorted.sort((a, b) => a.createdAt - b.createdAt)
    if (sortKey === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sortKey === 'size') sorted.sort((a, b) => b.size - a.size)
    return sorted
  }, [folderItems, tab, sortKey])

  const counts = useMemo(
    () => ({
      all: folderItems.length,
      note: folderItems.filter((i) => i.category === 'note').length,
      question: folderItems.filter((i) => i.category === 'question').length,
      practice: folderItems.filter((i) => i.category === 'practice').length,
    }),
    [folderItems]
  )

  useEffect(() => {
    if (!node) openFolder(null)
  }, [node, openFolder])
  if (!node) return null

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) setUploadFiles(files)
  }

  const suggested = SUGGESTED_CHILD[node.kind] ?? 'folder'
  const openCreate = (kind: NodeKind) => {
    setCreateKind(kind)
    setCreateOpen(true)
  }

  return (
    <div
      className="space-y-6"
      onDragEnter={(e) => {
        e.preventDefault()
        dragCounter.current++
        if (e.dataTransfer.types.includes('Files')) setDragOver(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragCounter.current--
        if (dragCounter.current <= 0) setDragOver(false)
      }}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="pointer-events-none fixed inset-4 z-50 flex items-center justify-center rounded-3xl border-4 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-primary bg-card px-8 py-6 text-center sketch ink-shadow">
            <FileUp className="mx-auto size-10 text-primary" aria-hidden />
            <p className="font-display text-3xl">Drop to file it in</p>
            <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
              add materials to “{node.name}”
            </p>
          </div>
        </div>
      )}

      <Breadcrumbs />

      {/* ── folder header ─────────────────────────────────────────── */}
      <header className="relative rounded-2xl border-2 border-border bg-card p-5 ink-shadow">
        <span className="tape" style={{ background: subjectColor + '4d' }} aria-hidden />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex size-14 shrink-0 rotate-[-3deg] items-center justify-center rounded-2xl text-white sketch"
              style={{ background: subjectColor }}
            >
              <NodeIcon kind={node.kind} className="size-7" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-4xl leading-tight">{node.name}</h1>
              <p className="font-hand text-[17px]" style={{ color: 'var(--ink-soft)' }}>
                {KIND_META[node.kind].label} · {children.length} {children.length === 1 ? 'section' : 'sections'} ·{' '}
                {folderItems.length} {folderItems.length === 1 ? 'material' : 'materials'}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Folder actions"
              className="flex size-10 items-center justify-center rounded-xl border-2 border-border bg-card hover:bg-secondary"
            >
              <MoreVertical className="size-5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-2 border-border">
              <DropdownMenuItem onClick={() => setRenameOpen(true)} className="gap-2 font-hand text-base">
                <Pencil className="size-4" aria-hidden /> Rename
              </DropdownMenuItem>
              {node.kind === 'subject' && (
                <DropdownMenuItem onClick={() => setRecolorOpen(true)} className="gap-2 font-hand text-base">
                  <Palette className="size-4" aria-hidden /> Change colour
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setMoveOpen(true)} className="gap-2 font-hand text-base">
                <Move className="size-4" aria-hidden /> Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="gap-2 font-hand text-base text-destructive focus:text-destructive">
                <Trash2 className="size-4" aria-hidden /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* add actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {suggested !== 'folder' && (
            <AddChip
              label={`New ${KIND_META[suggested].label.toLowerCase()}`}
              icon={<NodeIcon kind={suggested} className="size-4" />}
              color={subjectColor}
              onClick={() => openCreate(suggested)}
            />
          )}
          <AddChip
            label="New folder"
            icon={<NodeIcon kind="folder" className="size-4" />}
            onClick={() => openCreate('folder')}
          />
          <AddChip label="Upload files" icon={<FileUp className="size-4" />} onClick={() => setUploadFiles([])} />
          <AddChip label="Text note" icon={<NotebookPen className="size-4" />} onClick={() => setTextOpen(true)} />
        </div>
      </header>

      {/* ── subfolders ────────────────────────────────────────────── */}
      <section aria-label="Sections inside" className="space-y-3">
        <h2 className="font-display text-2xl">Inside this {KIND_META[node.kind].label.toLowerCase()}</h2>
        {children.length === 0 ? (
          <EmptyState
            icon={FolderPlus}
            title="Nothing filed here yet"
            hint={
              node.kind === 'subject'
                ? 'Add chapters (or any folders you like) to break this subject down.'
                : node.kind === 'chapter'
                  ? 'Add topics inside this chapter, or custom folders of your own.'
                  : node.kind === 'topic'
                    ? 'Add subtopics inside, or custom folders of your own.'
                    : 'Create folders inside, or add study material directly below.'
            }
            className="py-8"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => (
              <SubfolderCard key={c.id} node={c} subjectColor={subjectColor} />
            ))}
          </div>
        )}
      </section>

      {/* ── materials with category tabs ──────────────────────────── */}
      <section aria-label="Study material" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Study material</h2>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border-2 border-border bg-card px-2.5 py-1.5 font-hand text-base hover:bg-secondary">
                <ArrowDownUp className="size-4" aria-hidden />
                {sortKey === 'newest' && 'Newest first'}
                {sortKey === 'oldest' && 'Oldest first'}
                {sortKey === 'name' && 'By name'}
                {sortKey === 'size' && 'Largest first'}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-2 border-border">
                <DropdownMenuItem onClick={() => setSortKey('newest')} className="font-hand text-base">Newest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortKey('oldest')} className="font-hand text-base">Oldest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortKey('name')} className="font-hand text-base">By name</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortKey('size')} className="font-hand text-base">Largest first</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* category tabs */}
        <CategoryTabs
          counts={counts}
          active={tab}
          onChange={setTab}
          subjectColor={subjectColor}
        />

        {visibleItems.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title={tab === 'all' ? 'No material here yet' : `No ${tab === 'note' ? 'notes' : tab === 'question' ? 'questions' : 'practice sheets'} here`}
            hint="Upload PDFs and images, drop them anywhere on this page, or write a text note."
            className="py-8"
          />
        ) : (
          <ItemGrid items={visibleItems} />
        )}
      </section>

      {/* dialogs */}
      <CreateNodeDialog open={createOpen} onOpenChange={setCreateOpen} parentId={nodeId} defaultKind={createKind} />
      <UploadDialog open={uploadFiles !== null} onOpenChange={(v) => !v && setUploadFiles(null)} nodeId={nodeId} pendingFiles={uploadFiles ?? []} />
      <TextNoteDialog open={textOpen} onOpenChange={setTextOpen} nodeId={nodeId} />
      <RenameDialog open={renameOpen} onOpenChange={setRenameOpen} node={node} />
      <MoveDialog open={moveOpen} onOpenChange={setMoveOpen} mode="node" targetId={node.id} />
      <CreateNodeDialog
        open={recolorOpen}
        onOpenChange={setRecolorOpen}
        parentId={null}
        defaultKind="subject"
        editingNode={node}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${node.name}”?`}
        description="This removes this folder, every folder inside it, all stored material and their revision plans. This cannot be undone."
        onConfirm={async () => {
          await useApp.getState().deleteNode(node.id)
          toast.success(`Deleted “${node.name}” and everything inside`)
        }}
      />
    </div>
  )
}

function AddChip({
  label,
  icon,
  onClick,
  color,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-secondary/50 px-3 py-1.5 font-hand text-[15px] transition-all hover:-rotate-1 hover:border-solid"
      style={color ? { borderColor: color + '99' } : undefined}
    >
      {icon}
      {label}
    </button>
  )
}

function SubfolderCard({ node, subjectColor }: { node: StudyNode; subjectColor: string }) {
  const nodes = useApp((s) => s.nodes)
  const items = useApp((s) => s.items)
  const reviews = useApp((s) => s.reviews)
  const openFolder = useApp((s) => s.openFolder)

  const stats = useMemo(() => {
    const ids = [node.id, ...descendantIdsSafe(nodes, node.id)]
    const itemCount = Object.values(items).filter((i) => ids.includes(i.nodeId)).length
    let due = 0
    for (const it of Object.values(items)) {
      if (!ids.includes(it.nodeId)) continue
      const rv = reviewForItem(reviews, it.id)
      if (rv && !rv.suspended && rv.due <= Date.now()) due++
    }
    return { itemCount, due }
  }, [nodes, items, reviews, node.id])

  return (
    <button
      onClick={() => openFolder(node.id)}
      className="group flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3.5 text-left ink-shadow-sm ink-shadow-hover"
      aria-label={`Open ${node.name}`}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white transition-transform group-hover:rotate-[-4deg]"
        style={{ background: node.kind === 'folder' ? '#a29781' : subjectColor, borderRadius: '255px 15px 225px 15px / 15px 225px 15px 255px' }}
      >
        <NodeIcon kind={node.kind} className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-[15px] font-bold leading-tight">{node.name}</p>
        <p className="font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
          {KIND_META[node.kind].label} · {stats.itemCount} {stats.itemCount === 1 ? 'item' : 'items'}
          {stats.due > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-1" style={{ color: 'var(--margin-red)' }}>
              <Brain className="size-3.5" aria-hidden />
              {stats.due} due
            </span>
          )}
        </p>
      </div>
      <Plus className="size-4 rotate-45 opacity-0 transition-opacity group-hover:opacity-50" aria-hidden />
    </button>
  )
}

function descendantIdsSafe(nodes: Record<string, StudyNode>, rootId: string) {
  return descendantIds(nodes, rootId)
}
function CategoryTabs({
  counts,
  active,
  onChange,
  subjectColor,
}: {
  counts: { all: number; note: number; question: number; practice: number }
  active: 'all' | ItemCategory
  onChange: (t: 'all' | ItemCategory) => void
  subjectColor: string
}) {
  const tabs: { key: 'all' | ItemCategory; label: string; color: string; count: number }[] = [
    { key: 'all', label: 'All', color: subjectColor, count: counts.all },
    { key: 'note', label: 'Notes', color: '#d9a441', count: counts.note },
    { key: 'question', label: 'Questions', color: '#e07b39', count: counts.question },
    { key: 'practice', label: 'Practice Sheets', color: '#8b6fae', count: counts.practice },
  ]
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Material categories">
      {tabs.map((t) => {
        const isActive = active === t.key
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className="divider-tab flex items-center gap-2 px-4 py-2 font-hand text-[16px] transition-all"
            style={{
              background: isActive ? t.color : 'var(--secondary)',
              color: isActive ? '#fffaf2' : 'var(--ink-soft)',
              transform: isActive ? 'translateY(-1px)' : undefined,
              boxShadow: isActive ? '2px 2px 0 rgba(56,51,42,0.18)' : undefined,
            }}
          >
            {t.label}
            <span
              className="rounded-full px-1.5 py-px font-sans text-[11px] font-bold"
              style={{
                background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--card)',
                color: isActive ? '#fffaf2' : 'var(--ink-soft)',
              }}
            >
              {t.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export type { SortKey }
