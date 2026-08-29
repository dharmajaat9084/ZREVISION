'use client'

import { ChevronRight, LibraryBig } from 'lucide-react'
import { pathOf, useApp } from '@/lib/store'
import { NodeIcon } from '@/components/common/icons'
import { KIND_META } from '@/lib/types'

export function Breadcrumbs() {
  const nodes = useApp((s) => s.nodes)
  const folderId = useApp((s) => s.folderId)
  const openFolder = useApp((s) => s.openFolder)

  const path = pathOf(nodes, folderId)

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1 gap-y-1">
      <button
        onClick={() => openFolder(null)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-hand text-[17px] text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LibraryBig className="size-4" aria-hidden />
        Library
      </button>
      {path.map((n, i) => {
        const last = i === path.length - 1
        return (
          <span key={n.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0 opacity-40" aria-hidden />
            <button
              onClick={() => openFolder(n.id)}
              aria-current={last ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 font-hand text-[17px] transition-colors ${
                last ? 'bg-secondary text-foreground' : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
              }`}
              style={last ? { color: n.color } : undefined}
            >
              <NodeIcon kind={n.kind} className="size-4 shrink-0" />
              <span className="max-w-44 truncate">{n.name}</span>
              {last && (
                <span className="ml-0.5 hidden rounded-full border border-border bg-card px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-foreground/60 sm:inline">
                  {KIND_META[n.kind].label}
                </span>
              )}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
