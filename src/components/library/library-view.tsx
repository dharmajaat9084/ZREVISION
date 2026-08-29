'use client'

import { useMemo, useState } from 'react'
import { Brain, Plus, Sparkles } from 'lucide-react'
import { descendantIds, useApp } from '@/lib/store'
import { NodeIcon } from '@/components/common/icons'
import { EmptyState } from '@/components/common/empty-state'
import { FolderView } from './folder-view'
import { CreateNodeDialog } from './dialogs'
import { relTime } from '@/lib/helpers'
import type { StudyNode } from '@/lib/types'

export function LibraryView() {
  const folderId = useApp((s) => s.folderId)
  const [newSubject, setNewSubject] = useState(false)

  if (folderId) return <FolderView nodeId={folderId} />
  return (
    <>
      <SubjectsHome onNewSubject={() => setNewSubject(true)} />
      <CreateNodeDialog
        open={newSubject}
        onOpenChange={setNewSubject}
        parentId={null}
        defaultKind="subject"
      />
    </>
  )
}

function SubjectsHome({ onNewSubject }: { onNewSubject: () => void }) {
  const nodes = useApp((s) => s.nodes)
  const items = useApp((s) => s.items)
  const reviews = useApp((s) => s.reviews)

  const subjects = useMemo(
    () => Object.values(nodes).filter((n) => n.kind === 'subject').sort((a, b) => a.createdAt - b.createdAt),
    [nodes]
  )

  const statsFor = (subject: StudyNode) => {
    const treeIds = [subject.id, ...descendantIds(nodes, subject.id)]
    const treeItems = Object.values(items).filter((i) => treeIds.includes(i.nodeId))
    const chapters = Object.values(nodes).filter((n) => n.parentId === subject.id).length
    let due = 0
    for (const it of treeItems) {
      const rv = Object.values(reviews).find((r) => r.itemId === it.id)
      if (rv && !rv.suspended && rv.due <= Date.now()) due++
    }
    return { itemCount: treeItems.length, chapters, due }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">
            My <span className="text-primary">Library</span>
          </h1>
          <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
            subjects, chapters, topics — your whole syllabus, neatly filed
          </p>
        </div>
        <button
          onClick={onNewSubject}
          className="flex items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary px-4 py-2.5 font-hand text-lg text-primary-foreground sketch ink-shadow transition-transform hover:-rotate-1 hover:scale-[1.02]"
        >
          <Plus className="size-5" aria-hidden />
          New subject
        </button>
      </header>

      {subjects.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Your notebook is empty"
          hint="Create your first subject — say “Physics” — then add chapters, topics and all your notes, questions and practice sheets inside."
          action={
            <button
              onClick={onNewSubject}
              className="mt-1 flex items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary px-5 py-2.5 font-hand text-lg text-primary-foreground sketch ink-shadow"
            >
              <Plus className="size-5" aria-hidden />
              Create first subject
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const st = statsFor(s)
            return <SubjectCard key={s.id} subject={s} {...st} />
          })}
        </div>
      )}
    </div>
  )
}

function SubjectCard({
  subject,
  chapters,
  itemCount,
  due,
}: {
  subject: StudyNode
  chapters: number
  itemCount: number
  due: number
}) {
  const openFolder = useApp((s) => s.openFolder)
  return (
    <button
      onClick={() => openFolder(subject.id)}
      className="group relative overflow-hidden rounded-2xl border-2 border-border bg-card text-left ink-shadow ink-shadow-hover"
      style={{ borderTopColor: subject.color, borderTopWidth: 3 }}
      aria-label={`Open subject ${subject.name}`}
    >
      <span className="tape" style={{ background: subject.color + '59' }} aria-hidden />
      <div className="flex items-start gap-3 p-4 pt-5">
        <div
          className="flex size-11 shrink-0 rotate-[-3deg] items-center justify-center rounded-xl text-white sketch"
          style={{ background: subject.color }}
        >
          <NodeIcon kind="subject" className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-[17px] font-bold leading-tight">{subject.name}</p>
          <p className="font-hand text-[15px]" style={{ color: 'var(--ink-soft)' }}>
            {chapters} {chapters === 1 ? 'chapter' : 'chapters'} · {itemCount} {itemCount === 1 ? 'item' : 'items'} ·
            edited {relTime(subject.updatedAt)}
          </p>
        </div>
      </div>
      {due > 0 && (
        <div
          className="flex items-center gap-1.5 px-4 pb-3 font-hand text-[15px]"
          style={{ color: 'var(--margin-red)' }}
        >
          <Brain className="size-4" aria-hidden />
          {due} {due === 1 ? 'item' : 'items'} due for revision
        </div>
      )}
    </button>
  )
}
