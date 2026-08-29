/* ── display helpers ──────────────────────────────────────────────── */

import type { ItemCategory, ItemKind, NodeKind, StudyItem } from './types'

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

export function relTime(ts: number): string {
  const diff = Date.now() - ts
  const min = 60_000
  if (diff < min) return 'just now'
  if (diff < 60 * min) return `${Math.floor(diff / min)} min ago`
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))} hr ago`
  const days = Math.floor(diff / (24 * 60 * min))
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(a: number, b: number): number {
  return Math.floor((b - a) / 86_400_000)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** icon key for a node kind — resolved in components */
export const NODE_ICON: Record<NodeKind, string> = {
  subject: 'book-open',
  chapter: 'book-marked',
  topic: 'lightbulb',
  subtopic: 'circle-dot',
  folder: 'folder',
}

export const CATEGORY_ICON: Record<ItemCategory, string> = {
  note: 'sticky-note',
  question: 'help-circle',
  practice: 'pencil-line',
}

export function itemIconKey(item: StudyItem): string {
  if (item.kind === 'snapshot') return 'crop'
  if (item.kind === 'text') return 'notebook-pen'
  return item.fileKind === 'pdf' ? 'file-text' : 'image'
}

export function kindLabel(item: StudyItem): string {
  if (item.kind === 'snapshot') return 'Snapshot'
  if (item.kind === 'text') return 'Text note'
  return item.fileKind === 'pdf' ? 'PDF' : 'Image'
}

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  file: 'File',
  snapshot: 'Snapshot',
  text: 'Text note',
}
