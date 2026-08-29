/* ── StudyNest global store (zustand) ─────────────────────────────── */

'use client'

import { create } from 'zustand'
import {
  STORES,
  blobUrl,
  deleteBlob,
  getBlob,
  idbClear,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  loadAll,
  putBlob,
  revokeUrl,
  wipeEverything,
} from './db'
import { newReviewItem, schedule } from './srs'
import {
  DEFAULT_SETTINGS,
  SUBJECT_PALETTE,
  type ItemCategory,
  type ItemKind,
  type NodeKind,
  type Rating,
  type ReviewItem,
  type ReviewLogEntry,
  type Settings,
  type StudyItem,
  type StudyNode,
} from './types'

export type View = 'dashboard' | 'library' | 'review' | 'stats' | 'search' | 'settings'

export interface ReviewSession {
  queue: string[] // review ids
  index: number
  startedAt: number
  results: { itemId: string; rating: Rating }[]
}

interface AppState {
  hydrated: boolean
  nodes: Record<string, StudyNode>
  items: Record<string, StudyItem>
  reviews: Record<string, ReviewItem>
  logs: ReviewLogEntry[]
  settings: Settings
  recents: { id: string; at: number }[]

  // navigation / ui
  view: View
  folderId: string | null // null = library home (subjects grid)
  openItemId: string | null
  session: ReviewSession | null

  // lifecycle
  init: () => Promise<void>

  // nodes
  createNode: (parentId: string | null, kind: NodeKind, name: string, color?: string) => Promise<string>
  renameNode: (id: string, name: string) => Promise<void>
  recolorNode: (id: string, color: string) => Promise<void>
  moveNode: (id: string, parentId: string) => Promise<void>
  deleteNode: (id: string) => Promise<void>

  // items
  addFiles: (nodeId: string, files: File[], category: ItemCategory) => Promise<string[]>
  createTextItem: (nodeId: string, name: string, content: string, category: ItemCategory) => Promise<string>
  createSnapshotItem: (
    nodeId: string,
    name: string,
    blob: Blob,
    category: ItemCategory,
    sourceFileId?: string,
    sourcePage?: number
  ) => Promise<string>
  updateItem: (id: string, patch: Partial<Pick<StudyItem, 'name' | 'category' | 'textContent' | 'starred'>>) => Promise<void>
  moveItem: (id: string, nodeId: string) => Promise<void>
  deleteItem: (id: string) => Promise<void>

  // reviews
  addReview: (itemId: string) => Promise<void>
  removeReview: (itemId: string) => Promise<void>
  toggleSuspend: (itemId: string) => Promise<void>
  gradeReview: (itemId: string, rating: Rating, timeSpentSec: number) => Promise<void>
  postponeReview: (itemId: string, days: number) => Promise<void>
  reviewNow: (itemId: string) => Promise<void>

  // session
  startSession: (limit?: number) => void
  advanceSession: (rating: Rating | null, itemId: string) => void
  endSession: () => void

  // ui navigation
  setView: (v: View) => void
  openFolder: (nodeId: string | null) => void
  openItem: (id: string | null) => void
  touchRecent: (id: string) => Promise<void>

  // settings & data
  saveSettings: (patch: Partial<Settings>) => Promise<void>
  exportBackup: () => Promise<Blob>
  importBackup: (file: File) => Promise<void>
  wipeAll: () => Promise<void>
}

const now = () => Date.now()
const uid = () => crypto.randomUUID()

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** BFS over nodes map */
export function descendantIds(nodes: Record<string, StudyNode>, rootId: string): string[] {
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

export function pathOf(nodes: Record<string, StudyNode>, id: string | null): StudyNode[] {
  const path: StudyNode[] = []
  let cur = id ? nodes[id] : undefined
  let guard = 0
  while (cur && guard++ < 50) {
    path.unshift(cur)
    cur = cur.parentId ? nodes[cur.parentId] : undefined
  }
  return path
}

function fileKindOf(file: File): 'pdf' | 'image' | 'text' | null {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('image/')) return 'image'
  if (/\.(txt|md|markdown)$/i.test(file.name) || file.type.startsWith('text/')) return 'text'
  return null
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  nodes: {},
  items: {},
  reviews: {},
  logs: [],
  settings: { ...DEFAULT_SETTINGS },
  recents: [],

  view: 'dashboard',
  folderId: null,
  openItemId: null,
  session: null,

  init: async () => {
    const { nodes, items, reviews, logs, settings } = await loadAll()
    const recentRec = await idbGet<{ key: string; value: { id: string; at: number }[] }>(STORES.meta, 'recents')
    set({
      hydrated: true,
      nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
      items: Object.fromEntries(items.map((i) => [i.id, i])),
      reviews: Object.fromEntries(reviews.map((r) => [r.id, r])),
      logs: logs.sort((a, b) => a.date - b.date),
      settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
      recents: recentRec?.value ?? [],
    })
  },

  /* ── nodes ─────────────────────────────────────────────────────── */

  createNode: async (parentId, kind, name, color) => {
    const node: StudyNode = {
      id: uid(),
      parentId,
      kind,
      name: name.trim(),
      color: color ?? SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)],
      createdAt: now(),
      updatedAt: now(),
    }
    await idbPut(STORES.nodes, node)
    set((s) => ({ nodes: { ...s.nodes, [node.id]: node } }))
    return node.id
  },

  renameNode: async (id, name) => {
    const node = get().nodes[id]
    if (!node) return
    const updated = { ...node, name: name.trim(), updatedAt: now() }
    await idbPut(STORES.nodes, updated)
    set((s) => ({ nodes: { ...s.nodes, [id]: updated } }))
  },

  recolorNode: async (id, color) => {
    const node = get().nodes[id]
    if (!node) return
    const updated = { ...node, color, updatedAt: now() }
    await idbPut(STORES.nodes, updated)
    set((s) => ({ nodes: { ...s.nodes, [id]: updated } }))
  },

  moveNode: async (id, parentId) => {
    const { nodes } = get()
    const node = nodes[id]
    if (!node || id === parentId) return
    // prevent moving into own descendant
    if (descendantIds(nodes, id).includes(parentId)) return
    const updated = { ...node, parentId, updatedAt: now() }
    await idbPut(STORES.nodes, updated)
    set((s) => ({ nodes: { ...s.nodes, [id]: updated } }))
  },

  deleteNode: async (id) => {
    const { nodes, items, reviews } = get()
    const all = [id, ...descendantIds(nodes, id)]
    const doomedItems: StudyItem[] = []
    for (const it of Object.values(items)) {
      if (all.includes(it.nodeId)) doomedItems.push(it)
    }
    for (const it of doomedItems) {
      if (it.blobKey) {
        await deleteBlob(it.blobKey)
        revokeUrl(it.blobKey)
      }
      await idbDelete(STORES.items, it.id)
      const rv = Object.values(reviews).find((r) => r.itemId === it.id)
      if (rv) await idbDelete(STORES.reviews, rv.id)
    }
    for (const nid of all) await idbDelete(STORES.nodes, nid)
    set((s) => {
      const nodes2 = { ...s.nodes }
      const items2 = { ...s.items }
      const reviews2 = { ...s.reviews }
      for (const nid of all) delete nodes2[nid]
      for (const it of doomedItems) {
        delete items2[it.id]
        const rv = Object.values(reviews2).find((r) => r.itemId === it.id)
        if (rv) delete reviews2[rv.id]
      }
      const folderId = s.folderId && all.includes(s.folderId) ? null : s.folderId
      const openItemId = s.openItemId && items2[s.openItemId] === undefined ? null : s.openItemId
      return { nodes: nodes2, items: items2, reviews: reviews2, folderId, openItemId }
    })
  },

  /* ── items ─────────────────────────────────────────────────────── */

  addFiles: async (nodeId, files, category) => {
    const created: string[] = []
    for (const file of files) {
      const fk = fileKindOf(file)
      if (!fk) continue
      if (fk === 'text') {
        const text = await file.text()
        const name = file.name.replace(/\.(txt|md|markdown)$/i, '')
        const id = await get().createTextItem(nodeId, name, text, category)
        created.push(id)
      } else {
        const blobKey = 'blob-' + uid()
        await putBlob(blobKey, file)
        const item: StudyItem = {
          id: uid(),
          nodeId,
          kind: 'file',
          category,
          name: file.name.replace(/\.[^.]+$/, ''),
          fileKind: fk,
          mime: file.type,
          size: file.size,
          blobKey,
          createdAt: now(),
          updatedAt: now(),
        }
        await idbPut(STORES.items, item)
        set((s) => ({ items: { ...s.items, [item.id]: item } }))
        created.push(item.id)
      }
    }
    return created
  },

  createTextItem: async (nodeId, name, content, category) => {
    const item: StudyItem = {
      id: uid(),
      nodeId,
      kind: 'text',
      category,
      name: name.trim() || 'Untitled note',
      fileKind: 'text',
      size: new Blob([content]).size,
      textContent: content,
      createdAt: now(),
      updatedAt: now(),
    }
    await idbPut(STORES.items, item)
    set((s) => ({ items: { ...s.items, [item.id]: item } }))
    return item.id
  },

  createSnapshotItem: async (nodeId, name, blob, category, sourceFileId, sourcePage) => {
    const blobKey = 'blob-' + uid()
    await putBlob(blobKey, blob)
    const item: StudyItem = {
      id: uid(),
      nodeId,
      kind: 'snapshot',
      category,
      name: name.trim() || 'Snapshot',
      fileKind: 'image',
      mime: blob.type,
      size: blob.size,
      blobKey,
      sourceFileId,
      sourcePage,
      createdAt: now(),
      updatedAt: now(),
    }
    await idbPut(STORES.items, item)
    set((s) => ({ items: { ...s.items, [item.id]: item } }))
    return item.id
  },

  updateItem: async (id, patch) => {
    const item = get().items[id]
    if (!item) return
    const updated: StudyItem = { ...item, ...patch, updatedAt: now() }
    await idbPut(STORES.items, updated)
    set((s) => ({ items: { ...s.items, [id]: updated } }))
  },

  moveItem: async (id, nodeId) => {
    const item = get().items[id]
    if (!item) return
    const updated = { ...item, nodeId, updatedAt: now() }
    await idbPut(STORES.items, updated)
    set((s) => ({ items: { ...s.items, [id]: updated } }))
  },

  deleteItem: async (id) => {
    const item = get().items[id]
    if (!item) return
    if (item.blobKey) {
      await deleteBlob(item.blobKey)
      revokeUrl(item.blobKey)
    }
    await idbDelete(STORES.items, id)
    const rv = Object.values(get().reviews).find((r) => r.itemId === id)
    if (rv) await idbDelete(STORES.reviews, rv.id)
    // snapshots sourced from this file keep working (their blob is independent)
    set((s) => {
      const reviews2 = { ...s.reviews }
      if (rv) delete reviews2[rv.id]
      const recents2 = s.recents.filter((r) => r.id !== id)
      return {
        items: (() => {
          const it = { ...s.items }
          delete it[id]
          return it
        })(),
        reviews: reviews2,
        recents: recents2,
        openItemId: s.openItemId === id ? null : s.openItemId,
      }
    })
  },

  /* ── reviews ───────────────────────────────────────────────────── */

  addReview: async (itemId) => {
    const existing = Object.values(get().reviews).find((r) => r.itemId === itemId)
    if (existing) return
    const r = newReviewItem(itemId)
    await idbPut(STORES.reviews, r)
    set((s) => ({ reviews: { ...s.reviews, [r.id]: r } }))
  },

  removeReview: async (itemId) => {
    const rv = Object.values(get().reviews).find((r) => r.itemId === itemId)
    if (!rv) return
    await idbDelete(STORES.reviews, rv.id)
    set((s) => {
      const reviews2 = { ...s.reviews }
      delete reviews2[rv.id]
      return { reviews: reviews2 }
    })
  },

  toggleSuspend: async (itemId) => {
    const rv = Object.values(get().reviews).find((r) => r.itemId === itemId)
    if (!rv) return
    const updated = { ...rv, suspended: !rv.suspended }
    await idbPut(STORES.reviews, updated)
    set((s) => ({ reviews: { ...s.reviews, [rv.id]: updated } }))
  },

  gradeReview: async (itemId, rating, timeSpentSec) => {
    const rv = Object.values(get().reviews).find((r) => r.itemId === itemId)
    if (!rv) return
    const sched = schedule(rv, rating)
    const updated: ReviewItem = {
      ...rv,
      ...sched,
      lastReviewed: now(),
    }
    const log: ReviewLogEntry = {
      id: uid(),
      itemId,
      date: now(),
      rating,
      prevInterval: rv.interval,
      nextInterval: sched.interval,
      timeSpent: timeSpentSec,
    }
    await idbPut(STORES.reviews, updated)
    await idbPut(STORES.logs, log)
    set((s) => ({
      reviews: { ...s.reviews, [rv.id]: updated },
      logs: [...s.logs, log],
    }))
  },

  postponeReview: async (itemId, days) => {
    const rv = Object.values(get().reviews).find((r) => r.itemId === itemId)
    if (!rv) return
    const updated = { ...rv, due: Math.max(rv.due, now()) + days * 86_400_000 }
    await idbPut(STORES.reviews, updated)
    set((s) => ({ reviews: { ...s.reviews, [rv.id]: updated } }))
  },

  reviewNow: async (itemId) => {
    const rv = Object.values(get().reviews).find((r) => r.itemId === itemId)
    if (!rv) return
    const updated = { ...rv, due: now(), suspended: false }
    await idbPut(STORES.reviews, updated)
    set((s) => ({ reviews: { ...s.reviews, [rv.id]: updated } }))
  },

  /* ── session ───────────────────────────────────────────────────── */

  startSession: (limit) => {
    const { reviews, settings } = get()
    const horizon = now() + 3_600_000 // include short learning steps due within the hour
    const due = Object.values(reviews)
      .filter((r) => !r.suspended && r.due <= horizon)
      .sort((a, b) => a.due - b.due)
    const capped = settings.dailyLimit > 0 ? due.slice(0, settings.dailyLimit) : due
    const queue = limit && limit > 0 ? capped.slice(0, limit) : capped
    set({ session: { queue: queue.map((r) => r.id), index: 0, startedAt: now(), results: [] }, view: 'review' })
  },

  advanceSession: (rating, itemId) => {
    set((s) => {
      if (!s.session) return {}
      return {
        session: {
          ...s.session,
          index: s.session.index + 1,
          results: rating ? [...s.session.results, { itemId, rating }] : s.session.results,
        },
      }
    })
  },

  endSession: () => set({ session: null }),

  /* ── ui ────────────────────────────────────────────────────────── */

  setView: (v) => set({ view: v }),
  openFolder: (nodeId) => set({ folderId: nodeId, view: 'library' }),
  openItem: (id) => set({ openItemId: id }),

  touchRecent: async (id) => {
    const list = [{ id, at: now() }, ...get().recents.filter((r) => r.id !== id)].slice(0, 12)
    await idbPut(STORES.meta, { key: 'recents', value: list })
    set({ recents: list })
  },

  /* ── settings & data ───────────────────────────────────────────── */

  saveSettings: async (patch) => {
    const settings = { ...get().settings, ...patch }
    await idbPut(STORES.meta, { key: 'settings', value: settings })
    set({ settings })
  },

  exportBackup: async () => {
    const { nodes, items, reviews, logs, settings } = get()
    const blobRecs = await idbGetAll<{ key: string; blob: Blob }>(STORES.blobs)
    const blobs = await Promise.all(
      blobRecs.map(async (b) => {
        const dataUrl = await blobToDataUrl(b.blob)
        return { key: b.key, mime: b.blob.type, size: b.blob.size, dataBase64: dataUrl.split(',')[1] ?? '' }
      })
    )
    const dump = {
      version: 1 as const,
      exportedAt: now(),
      nodes: Object.values(nodes),
      items: Object.values(items),
      reviews: Object.values(reviews),
      logs,
      settings,
      blobs,
    }
    return new Blob([JSON.stringify(dump)], { type: 'application/json' })
  },

  importBackup: async (file) => {
    const text = await file.text()
    const dump = JSON.parse(text) as {
      nodes: StudyNode[]
      items: StudyItem[]
      reviews: ReviewItem[]
      logs: ReviewLogEntry[]
      settings: Settings
      blobs: { key: string; mime: string; dataBase64: string }[]
    }
    if (!dump.nodes || !dump.items) throw new Error('Not a StudyNest backup file')
    await wipeEverything()
    for (const b of dump.blobs ?? []) {
      await putBlob(b.key, dataUrlToBlob(`data:${b.mime};base64,${b.dataBase64}`))
    }
    for (const n of dump.nodes) await idbPut(STORES.nodes, n)
    for (const i of dump.items) await idbPut(STORES.items, i)
    for (const r of dump.reviews ?? []) await idbPut(STORES.reviews, r)
    for (const l of dump.logs ?? []) await idbPut(STORES.logs, l)
    const settings = { ...DEFAULT_SETTINGS, ...(dump.settings ?? {}) }
    await idbPut(STORES.meta, { key: 'settings', value: settings })
    set({
      nodes: Object.fromEntries(dump.nodes.map((n) => [n.id, n])),
      items: Object.fromEntries(dump.items.map((i) => [i.id, i])),
      reviews: Object.fromEntries((dump.reviews ?? []).map((r) => [r.id, r])),
      logs: (dump.logs ?? []).sort((a, b) => a.date - b.date),
      settings,
      recents: [],
      session: null,
      openItemId: null,
      folderId: null,
      view: 'dashboard',
    })
  },

  wipeAll: async () => {
    await wipeEverything()
    await idbPut(STORES.meta, { key: 'settings', value: { ...DEFAULT_SETTINGS } })
    set({
      nodes: {},
      items: {},
      reviews: {},
      logs: [],
      recents: [],
      session: null,
      openItemId: null,
      folderId: null,
      settings: { ...DEFAULT_SETTINGS },
    })
  },
}))

/* ── shared selectors / helpers ───────────────────────────────────── */

export function reviewForItem(reviews: Record<string, ReviewItem>, itemId: string): ReviewItem | undefined {
  return Object.values(reviews).find((r) => r.itemId === itemId)
}

export async function itemBlobUrl(item: StudyItem): Promise<string | null> {
  if (!item.blobKey) return null
  try {
    return await blobUrl(item.blobKey)
  } catch {
    return null
  }
}

export async function itemBlob(item: StudyItem): Promise<Blob | null> {
  if (!item.blobKey) return null
  return getBlob(item.blobKey) ?? null
}

export function countItemsInTree(
  nodes: Record<string, StudyNode>,
  items: Record<string, StudyItem>,
  rootId: string
): number {
  const ids = [rootId, ...descendantIds(nodes, rootId)]
  return Object.values(items).filter((i) => ids.includes(i.nodeId)).length
}
