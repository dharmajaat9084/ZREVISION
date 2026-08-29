/* ── Central icon registry — one visual language across the app ──── */

import {
  BookMarked,
  BookOpen,
  CircleDot,
  Crop,
  FileText,
  Folder,
  HelpCircle,
  Image as ImageIcon,
  Lightbulb,
  NotebookPen,
  PencilLine,
  StickyNote,
  type LucideIcon,
} from 'lucide-react'
import type { ItemCategory, NodeKind, StudyItem } from '@/lib/types'

export const NODE_ICONS: Record<NodeKind, LucideIcon> = {
  subject: BookOpen,
  chapter: BookMarked,
  topic: Lightbulb,
  subtopic: CircleDot,
  folder: Folder,
}

export const CATEGORY_ICONS: Record<ItemCategory, LucideIcon> = {
  note: StickyNote,
  question: HelpCircle,
  practice: PencilLine,
}

export function ItemIcon({ item, className }: { item: StudyItem; className?: string }) {
  if (item.kind === 'snapshot') return <Crop className={className} aria-hidden />
  if (item.kind === 'text') return <NotebookPen className={className} aria-hidden />
  if (item.fileKind === 'pdf') return <FileText className={className} aria-hidden />
  return <ImageIcon className={className} aria-hidden />
}

export function NodeIcon({ kind, className }: { kind: NodeKind; className?: string }) {
  const Icon = NODE_ICONS[kind]
  return <Icon className={className} aria-hidden />
}

export function CategoryIcon({ category, className }: { category: ItemCategory; className?: string }) {
  const Icon = CATEGORY_ICONS[category]
  return <Icon className={className} aria-hidden />
}
