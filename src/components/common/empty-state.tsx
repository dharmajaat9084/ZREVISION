'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/80 bg-card/50 px-6 py-12 text-center',
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-full bg-secondary sketch">
        <Icon className="size-8 text-ink-soft" style={{ color: 'var(--ink-soft)' }} aria-hidden />
      </div>
      <div>
        <p className="font-display text-2xl text-foreground">{title}</p>
        {hint && (
          <p className="font-hand mt-1 max-w-sm text-lg leading-snug" style={{ color: 'var(--ink-soft)' }}>
            {hint}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
