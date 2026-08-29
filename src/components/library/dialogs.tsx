'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, FileUp, Info } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { NodeIcon, CategoryIcon } from '@/components/common/icons'
import { useApp } from '@/lib/store'
import { CATEGORY_META, KIND_META, SUBJECT_PALETTE, type ItemCategory, type NodeKind, type StudyItem, type StudyNode } from '@/lib/types'
import { formatBytes } from '@/lib/helpers'
import { fileIconOf } from './upload-utils'
import { cn } from '@/lib/utils'

/* ── shared bits ──────────────────────────────────────────────────── */

function CategoryPicker({ value, onChange }: { value: ItemCategory; onChange: (c: ItemCategory) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Category">
      {(Object.keys(CATEGORY_META) as ItemCategory[]).map((c) => {
        const meta = CATEGORY_META[c]
        const active = value === c
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 font-hand text-[15px] transition-all',
              active ? 'ink-shadow-sm -rotate-1' : 'border-dashed opacity-70 hover:opacity-100'
            )}
            style={active ? { borderColor: meta.color, background: meta.soft } : undefined}
          >
            <CategoryIcon category={c} className="size-5" />
            {meta.plural}
          </button>
        )
      })}
    </div>
  )
}

/* ── create / edit folder dialog ──────────────────────────────────── */

const CHILD_KINDS: NodeKind[] = ['chapter', 'topic', 'subtopic', 'folder']

export function CreateNodeDialog({
  open,
  onOpenChange,
  parentId,
  defaultKind,
  editingNode,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  parentId: string | null
  defaultKind: NodeKind
  editingNode?: StudyNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sketch max-h-[90dvh] overflow-y-auto border-2 border-border bg-card sm:max-w-md">
        <CreateNodeForm
          parentId={parentId}
          defaultKind={defaultKind}
          editingNode={editingNode}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function CreateNodeForm({
  parentId,
  defaultKind,
  editingNode,
  onDone,
}: {
  parentId: string | null
  defaultKind: NodeKind
  editingNode?: StudyNode
  onDone: () => void
}) {
  const nodes = useApp((s) => s.nodes)
  const createNode = useApp((s) => s.createNode)
  const renameNode = useApp((s) => s.renameNode)
  const recolorNode = useApp((s) => s.recolorNode)
  const openFolder = useApp((s) => s.openFolder)

  const isSubject = editingNode ? editingNode.kind === 'subject' : defaultKind === 'subject'
  const [kind, setKind] = useState<NodeKind>(defaultKind)
  const [name, setName] = useState(editingNode?.name ?? '')
  const [color, setColor] = useState(editingNode?.color ?? SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)])

  const parentName = parentId ? nodes[parentId]?.name : null
  const editing = !!editingNode

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (editing) {
      if (isSubject) await recolorNode(editingNode!.id, color)
      else await renameNode(editingNode!.id, trimmed)
      toast.success('Updated')
      onDone()
      return
    }
    const id = await createNode(parentId, kind, trimmed, isSubject ? color : undefined)
    toast.success(`${KIND_META[kind].label} “${trimmed}” created`)
    onDone()
    openFolder(id)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">
          {editing ? (isSubject ? 'Edit subject' : 'Rename') : isSubject ? 'New subject' : `New ${KIND_META[kind].label.toLowerCase()}`}
        </DialogTitle>
        <DialogDescription className="font-hand text-base">
          {editing
            ? isSubject
              ? 'Pick a fresh colour (and name) for this notebook.'
              : `Rename “${editingNode?.name}”.`
            : parentName
              ? `It will live inside “${parentName}”.`
              : 'A brand-new notebook on your shelf.'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {!editing && !isSubject && (
          <div>
            <Label className="font-hand text-base">What are you creating?</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {CHILD_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    'flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 font-hand text-[15px] transition-all',
                    kind === k ? 'border-primary bg-secondary ink-shadow-sm -rotate-1' : 'border-dashed border-border opacity-70 hover:opacity-100'
                  )}
                >
                  <NodeIcon kind={k} className="size-4" />
                  {KIND_META[k].label}
                </button>
              ))}
            </div>
          </div>
        )}

          {!(editing && !isSubject) && (
            <div>
              <Label htmlFor="node-name" className="font-hand text-base">
                Name
              </Label>
              <Input
                id="node-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder={isSubject ? 'e.g. Physics' : kind === 'chapter' ? 'e.g. Chapter 2 — Kinematics' : 'e.g. Formulae'}
                className="mt-1 border-2 border-border bg-card font-sans font-semibold"
              />
            </div>
          )}

        {isSubject && (
          <div>
            <Label className="font-hand text-base">Notebook colour</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUBJECT_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full border-2 transition-transform',
                    color === c ? 'scale-110 border-foreground' : 'border-transparent hover:scale-105'
                  )}
                  style={{ background: c }}
                >
                  {color === c && <Check className="size-4 text-white" aria-hidden />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone} className="sketch border-2 border-border bg-card font-hand text-base">
          Cancel
        </Button>
        <Button onClick={submit} disabled={!name.trim() && !(editing && isSubject)} className="sketch border-2 border-primary/60 font-hand text-base">
          {editing ? 'Save' : 'Create'}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ── upload dialog ────────────────────────────────────────────────── */

export function UploadDialog({
  open,
  onOpenChange,
  nodeId,
  pendingFiles,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  nodeId: string
  pendingFiles: File[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sketch max-h-[90dvh] overflow-y-auto border-2 border-border bg-card sm:max-w-md">
        <UploadForm nodeId={nodeId} pendingFiles={pendingFiles} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function UploadForm({ nodeId, pendingFiles, onDone }: { nodeId: string; pendingFiles: File[]; onDone: () => void }) {
  const nodes = useApp((s) => s.nodes)
  const addFiles = useApp((s) => s.addFiles)
  const addReview = useApp((s) => s.addReview)
  const [files, setFiles] = useState<File[]>(pendingFiles)
  const [category, setCategory] = useState<ItemCategory>('note')
  const [toRevision, setToRevision] = useState(true)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const valid = files.filter((f) => fileIconOf(f) !== null)
  const invalidCount = files.length - valid.length

  const submit = async () => {
    if (valid.length === 0) return
    setBusy(true)
    try {
      const ids = await addFiles(nodeId, valid, category)
      if (toRevision) for (const id of ids) await addReview(id)
      toast.success(
        `${ids.length} ${ids.length === 1 ? 'material' : 'materials'} filed${toRevision ? ' & added to revision' : ''}`
      )
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">Add material</DialogTitle>
        <DialogDescription className="font-hand text-base">
          PDFs, images and text files — filed into “{nodes[nodeId]?.name}”.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label className="font-hand text-base">Files</Label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-1.5 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-4 py-5 font-hand text-base transition-colors hover:bg-secondary"
          >
            <FileUp className="size-6 text-primary" aria-hidden />
            {files.length === 0 ? 'Tap to choose files' : 'Add more files'}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              setFiles((prev) => [...prev, ...picked])
              e.target.value = ''
            }}
          />
          {files.length > 0 && (
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
              {files.map((f, i) => (
                <li key={f.name + i} className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-sm">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background: fileIconOf(f) === 'pdf' ? '#c65953' : fileIconOf(f) === 'image' ? '#4f8f7b' : '#7d9a4a',
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate font-sans font-semibold">{f.name}</span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {formatBytes(f.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded px-1 text-xs hover:bg-card"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {invalidCount > 0 && (
            <p className="mt-1.5 font-hand text-sm" style={{ color: 'var(--margin-red)' }}>
              {invalidCount} unsupported {invalidCount === 1 ? 'file' : 'files'} will be skipped (PDF, image or text only)
            </p>
          )}
        </div>

        <div>
          <Label className="font-hand text-base">File it under</Label>
          <div className="mt-1.5">
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-border bg-secondary/40 p-3">
          <Checkbox checked={toRevision} onCheckedChange={(v) => setToRevision(v === true)} className="mt-0.5" />
          <span>
            <span className="font-hand text-[15px]">Add to my revision plan</span>
            <span className="block text-xs" style={{ color: 'var(--ink-soft)' }}>
              spaced repetition will remind you when to revise these
            </span>
          </span>
        </label>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone} className="sketch border-2 border-border bg-card font-hand text-base">
          Cancel
        </Button>
        <Button onClick={submit} disabled={valid.length === 0 || busy} className="sketch border-2 border-primary/60 font-hand text-base">
          {busy ? 'Filing…' : `Add ${valid.length || ''}`}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ── text note dialog ─────────────────────────────────────────────── */

export function TextNoteDialog({
  open,
  onOpenChange,
  nodeId,
  editingItem,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  nodeId: string
  editingItem?: StudyItem
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sketch max-h-[90dvh] overflow-y-auto border-2 border-border bg-card sm:max-w-lg">
        <TextNoteForm nodeId={nodeId} editingItem={editingItem} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function TextNoteForm({ nodeId, editingItem, onDone }: { nodeId: string; editingItem?: StudyItem; onDone: () => void }) {
  const nodes = useApp((s) => s.nodes)
  const createTextItem = useApp((s) => s.createTextItem)
  const updateItem = useApp((s) => s.updateItem)
  const addReview = useApp((s) => s.addReview)
  const openItem = useApp((s) => s.openItem)

  const [name, setName] = useState(editingItem?.name ?? '')
  const [content, setContent] = useState(editingItem?.textContent ?? '')
  const [category, setCategory] = useState<ItemCategory>(editingItem?.category ?? 'note')
  const [toRevision, setToRevision] = useState(!editingItem)

  const submit = async () => {
    if (!name.trim() && !content.trim()) return
    if (editingItem) {
      await updateItem(editingItem.id, {
        name: name.trim() || 'Untitled note',
        textContent: content,
        category,
      })
      toast.success('Note saved')
    } else {
      const id = await createTextItem(nodeId, name.trim() || 'Untitled note', content, category)
      if (toRevision) await addReview(id)
      openItem(id)
      toast.success('Text note created')
    }
    onDone()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">{editingItem ? 'Edit note' : 'New text note'}</DialogTitle>
        <DialogDescription className="font-hand text-base">
          {editingItem ? 'Fix it up — changes save on this device.' : `Written into “${nodes[nodeId]?.name}”.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="note-name" className="font-hand text-base">
            Title
          </Label>
          <Input
            id="note-name"
            autoFocus={!editingItem}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Derivations to remember"
            className="mt-1 border-2 border-border bg-card font-sans font-semibold"
          />
        </div>
        <CategoryPicker value={category} onChange={setCategory} />
        <div>
          <Label htmlFor="note-content" className="font-hand text-base">
            Your note
          </Label>
          <Textarea
            id="note-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write formulas, definitions, summaries…"
            className="mt-1 min-h-40 border-2 border-border bg-card font-sans leading-relaxed"
          />
        </div>
        {!editingItem && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-2 border-border bg-secondary/40 p-3">
            <Checkbox checked={toRevision} onCheckedChange={(v) => setToRevision(v === true)} className="mt-0.5" />
            <span>
              <span className="font-hand text-[15px]">Add to my revision plan</span>
              <span className="block text-xs" style={{ color: 'var(--ink-soft)' }}>
                this note becomes a revision element
              </span>
            </span>
          </label>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone} className="sketch border-2 border-border bg-card font-hand text-base">
          Cancel
        </Button>
        <Button onClick={submit} disabled={!name.trim() && !content.trim()} className="sketch border-2 border-primary/60 font-hand text-base">
          {editingItem ? 'Save' : 'Create note'}
        </Button>
      </DialogFooter>
    </>
  )
}

/* ── rename dialogs ───────────────────────────────────────────────── */

export function RenameDialog({ open, onOpenChange, node }: { open: boolean; onOpenChange: (v: boolean) => void; node: StudyNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sketch border-2 border-border bg-card sm:max-w-sm">
        <RenameForm node={node} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RenameForm({ node, onDone }: { node: StudyNode; onDone: () => void }) {
  const renameNode = useApp((s) => s.renameNode)
  const [name, setName] = useState(node.name)
  const save = () => {
    if (name.trim()) renameNode(node.id, name)
    onDone()
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">Rename</DialogTitle>
        <DialogDescription className="font-hand text-base">{KIND_META[node.kind].label} name</DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className="border-2 border-border bg-card font-sans font-semibold"
      />
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone} className="sketch border-2 border-border bg-card font-hand text-base">
          Cancel
        </Button>
        <Button onClick={save} disabled={!name.trim()} className="sketch border-2 border-primary/60 font-hand text-base">
          Save
        </Button>
      </DialogFooter>
    </>
  )
}

export function RenameItemDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: StudyItem }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sketch border-2 border-border bg-card sm:max-w-sm">
        <RenameItemForm item={item} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RenameItemForm({ item, onDone }: { item: StudyItem; onDone: () => void }) {
  const updateItem = useApp((s) => s.updateItem)
  const [name, setName] = useState(item.name)
  const save = () => {
    if (name.trim()) updateItem(item.id, { name })
    onDone()
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-3xl">Rename material</DialogTitle>
        <DialogDescription className="font-hand text-base">Give it a clearer name</DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        className="border-2 border-border bg-card font-sans font-semibold"
      />
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onDone} className="sketch border-2 border-border bg-card font-hand text-base">
          Cancel
        </Button>
        <Button onClick={save} disabled={!name.trim()} className="sketch border-2 border-primary/60 font-hand text-base">
          Save
        </Button>
      </DialogFooter>
    </>
  )
}

/* ── move dialog (tree picker) ────────────────────────────────────── */

export function MoveDialog({
  open,
  onOpenChange,
  mode,
  targetId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'node' | 'item'
  targetId: string
}) {
  const nodes = useApp((s) => s.nodes)
  const items = useApp((s) => s.items)
  const moveNode = useApp((s) => s.moveNode)
  const moveItem = useApp((s) => s.moveItem)

  const target = mode === 'node' ? nodes[targetId] : undefined
  const targetItem = mode === 'item' ? items[targetId] : undefined
  const blocked = useMemo(() => {
    if (mode !== 'node' || !target) return new Set<string>()
    return new Set([targetId, ...descendantIdsOf(nodes, targetId)])
  }, [mode, nodes, target, targetId])

  const subjects = useMemo(
    () => Object.values(nodes).filter((n) => n.kind === 'subject').sort((a, b) => a.createdAt - b.createdAt),
    [nodes]
  )

  const move = async (destId: string) => {
    if (mode === 'node') await moveNode(targetId, destId)
    else await moveItem(targetId, destId)
    toast.success('Moved')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sketch max-h-[85dvh] overflow-y-auto border-2 border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Move</DialogTitle>
          <DialogDescription className="font-hand text-base">
            {mode === 'node' ? `Where should “${target?.name}” live now?` : `File “${targetItem?.name}” somewhere else`}
          </DialogDescription>
        </DialogHeader>

        {mode === 'node' && target?.kind === 'subject' ? (
          <div className="flex items-start gap-2.5 rounded-xl border-2 border-dashed border-border bg-secondary/40 p-3">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Subjects always sit at the top of your library — you can reorder everything inside them instead.
            </p>
          </div>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border-2 border-border bg-secondary/30 p-2">
            {subjects.map((s) => (
              <TreeRow
                key={s.id}
                node={s}
                depth={0}
                nodes={nodes}
                blocked={blocked}
                currentParent={mode === 'node' ? target?.parentId : targetItem?.nodeId}
                onMove={move}
              />
            ))}
            {subjects.length === 0 && (
              <p className="p-3 text-center font-hand text-base" style={{ color: 'var(--ink-soft)' }}>
                Create a subject first
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TreeRow({
  node,
  depth,
  nodes,
  blocked,
  currentParent,
  onMove,
}: {
  node: StudyNode
  depth: number
  nodes: Record<string, StudyNode>
  blocked: Set<string>
  currentParent?: string | null
  onMove: (id: string) => void
}) {
  const children = Object.values(nodes)
    .filter((n) => n.parentId === node.id)
    .sort((a, b) => a.createdAt - b.createdAt)
  const isBlocked = blocked.has(node.id)
  const isCurrent = currentParent === node.id

  return (
    <>
      <div
        className={cn('group flex items-center gap-2 rounded-lg px-2 py-1.5', isBlocked ? 'opacity-40' : 'hover:bg-card')}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <NodeIcon kind={node.kind} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-sans text-sm font-semibold">{node.name}</span>
        {isCurrent ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 font-hand text-xs">current</span>
        ) : (
          <button
            type="button"
            disabled={isBlocked}
            onClick={() => onMove(node.id)}
            className="rounded-lg border-2 border-border bg-card px-2 py-0.5 font-hand text-xs opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
          >
            move here
          </button>
        )}
      </div>
      {children.map((c) => (
        <TreeRow
          key={c.id}
          node={c}
          depth={depth + 1}
          nodes={nodes}
          blocked={blocked}
          currentParent={currentParent}
          onMove={onMove}
        />
      ))}
    </>
  )
}

function descendantIdsOf(nodes: Record<string, StudyNode>, rootId: string): string[] {
  const out: string[] = []
  const queue = [rootId]
  while (queue.length) {
    const cur = queue.shift()!
    for (const n of Object.values(nodes)) {
      if (n.parentId === cur) {
        out.push(n.id)
        queue.push(n.id)
      }
    }
  }
  return out
}
