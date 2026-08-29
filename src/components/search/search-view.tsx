'use client'

import { useMemo, useState } from 'react'
import { FolderOpen, Search as SearchIcon, X } from 'lucide-react'
import { pathOf, useApp } from '@/lib/store'
import { ItemIcon, NodeIcon } from '@/components/common/icons'
import { EmptyState } from '@/components/common/empty-state'
import { CATEGORY_META, type ItemCategory } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'folder' | ItemCategory

export function SearchView() {
  const nodes = useApp((s) => s.nodes)
  const items = useApp((s) => s.items)
  const openFolder = useApp((s) => s.openFolder)
  const openItem = useApp((s) => s.openItem)
  const touchRecent = useApp((s) => s.touchRecent)

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const query = q.trim().toLowerCase()

  const results = useMemo(() => {
    if (!query) return { folders: [], materials: [] }
    const folders = Object.values(nodes)
      .filter((n) => n.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12)
    const materials = Object.values(items)
      .filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          (i.textContent ?? '').toLowerCase().includes(query)
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 30)
    return { folders, materials }
  }, [nodes, items, query])

  const visibleFolders = filter === 'folder' || filter === 'all' ? results.folders : []
  const visibleMaterials =
    filter === 'all' || filter === 'note' || filter === 'question' || filter === 'practice'
      ? results.materials.filter((i) => filter === 'all' || i.category === filter)
      : []

  const total = visibleFolders.length + visibleMaterials.length

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="flex size-12 rotate-[-4deg] items-center justify-center rounded-2xl bg-primary text-primary-foreground sketch ink-shadow">
          <SearchIcon className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Search</h1>
          <p className="font-hand text-lg" style={{ color: 'var(--ink-soft)' }}>
            rummage through every page of your notebook
          </p>
        </div>
      </header>

      {/* search box */}
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-4 size-5 -translate-y-1/2" style={{ color: 'var(--ink-soft)' }} aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="chapter names, notes, formulas inside text notes…"
          aria-label="Search your library"
          className="w-full rounded-2xl border-2 border-border bg-card py-3.5 pr-12 pl-12 font-sans text-base font-semibold shadow-inner placeholder:font-normal placeholder:text-[var(--ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="Clear search"
            className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-secondary"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter results">
        {(
          [
            { key: 'all' as Filter, label: 'Everything' },
            { key: 'folder' as Filter, label: 'Folders' },
            { key: 'note' as Filter, label: 'Notes' },
            { key: 'question' as Filter, label: 'Questions' },
            { key: 'practice' as Filter, label: 'Practice' },
          ]
        ).map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn('divider-tab rounded-lg px-3.5 py-1.5 font-hand text-[15px] transition-all', filter === f.key ? 'ink-shadow-sm -translate-y-0.5' : 'opacity-70 hover:opacity-100')}
            style={filter === f.key ? { background: 'var(--secondary)' } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!query ? (
        <EmptyState
          icon={SearchIcon}
          title="Start typing to dig in"
          hint="Searches folder names, material names and the full text of your written notes."
        />
      ) : total === 0 ? (
        <EmptyState icon={SearchIcon} title={`Nothing found for “${q}”`} hint="Try a shorter word — or check the spelling." />
      ) : (
        <div className="space-y-5">
          {visibleFolders.length > 0 && (
            <section aria-label="Folder results" className="space-y-2">
              <h2 className="font-display text-2xl">Folders</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleFolders.map((n) => {
                  const path = pathOf(nodes, n.parentId)
                  return (
                    <button
                      key={n.id}
                      onClick={() => openFolder(n.id)}
                      className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-3 text-left ink-shadow-sm ink-shadow-hover"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: path[0]?.color ?? '#7d9a4a' }}>
                        <NodeIcon kind={n.kind} className="size-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-sans text-sm font-bold">{n.name}</span>
                        <span className="block truncate font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
                          {path.map((p) => p.name).join(' / ') || 'Library'}
                        </span>
                      </span>
                      <FolderOpen className="size-4 shrink-0 opacity-50" aria-hidden />
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {visibleMaterials.length > 0 && (
            <section aria-label="Material results" className="space-y-2">
              <h2 className="font-display text-2xl">Materials</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleMaterials.map((i) => {
                  const path = pathOf(nodes, i.nodeId)
                  const cat = CATEGORY_META[i.category]
                  return (
                    <button
                      key={i.id}
                      onClick={() => {
                        openItem(i.id)
                        touchRecent(i.id)
                      }}
                      className="flex items-center gap-3 rounded-xl border-2 border-border bg-card p-3 text-left ink-shadow-sm ink-shadow-hover"
                      style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: cat.color }}>
                        <ItemIcon item={i} className="size-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-sans text-sm font-bold">{i.name}</span>
                        <span className="block truncate font-hand text-sm" style={{ color: 'var(--ink-soft)' }}>
                          {path.map((p) => p.name).join(' / ')}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
