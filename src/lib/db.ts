/* ── IndexedDB wrapper for StudyNest (100% local, no server) ──────── */

import type { ReviewItem, ReviewLogEntry, Settings, StudyItem, StudyNode } from './types'

const DB_NAME = 'studynest-db'
const DB_VERSION = 1

export const STORES = {
  nodes: 'nodes',
  items: 'items',
  blobs: 'blobs',
  reviews: 'reviews',
  logs: 'logs',
  meta: 'meta',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORES.nodes)) {
        const s = db.createObjectStore(STORES.nodes, { keyPath: 'id' })
        s.createIndex('parentId', 'parentId')
      }
      if (!db.objectStoreNames.contains(STORES.items)) {
        const s = db.createObjectStore(STORES.items, { keyPath: 'id' })
        s.createIndex('nodeId', 'nodeId')
      }
      if (!db.objectStoreNames.contains(STORES.blobs)) {
        db.createObjectStore(STORES.blobs, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORES.reviews)) {
        const s = db.createObjectStore(STORES.reviews, { keyPath: 'id' })
        s.createIndex('itemId', 'itemId')
      }
      if (!db.objectStoreNames.contains(STORES.logs)) {
        const s = db.createObjectStore(STORES.logs, { keyPath: 'id' })
        s.createIndex('date', 'date')
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const req = fn(s)
        t.oncomplete = () => resolve((req as IDBRequest<T>)?.result ?? (undefined as unknown as T))
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      })
  )
}

/* ── generic helpers ──────────────────────────────────────────────── */

export async function idbGetAll<T>(store: string): Promise<T[]> {
  return tx<T[]>(store, 'readonly', (s) => s.getAll()) ?? []
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return tx<T | undefined>(store, 'readonly', (s) => s.get(key))
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  await tx(store, 'readwrite', (s) => {
    s.put(value as unknown as Record<string, unknown>)
  })
}

export async function idbDelete(store: string, key: string): Promise<void> {
  await tx(store, 'readwrite', (s) => {
    s.delete(key)
  })
}

export async function idbClear(store: string): Promise<void> {
  await tx(store, 'readwrite', (s) => {
    s.clear()
  })
}

/* ── blobs ────────────────────────────────────────────────────────── */

export async function putBlob(key: string, blob: Blob): Promise<void> {
  await idbPut(STORES.blobs, { key, blob })
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const rec = await idbGet<{ key: string; blob: Blob }>(STORES.blobs, key)
  return rec?.blob
}

export async function deleteBlob(key: string): Promise<void> {
  await idbDelete(STORES.blobs, key)
}

/* ── blob URL cache (revoke-able) ─────────────────────────────────── */

const urlCache = new Map<string, string>()

export async function blobUrl(key: string): Promise<string> {
  const cached = urlCache.get(key)
  if (cached) return cached
  const blob = await getBlob(key)
  if (!blob) throw new Error('Blob not found: ' + key)
  const url = URL.createObjectURL(blob)
  urlCache.set(key, url)
  return url
}

export function revokeUrl(key: string) {
  const url = urlCache.get(key)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(key)
  }
}

/* ── full load / restore / wipe (used by store + backup) ──────────── */

export interface FullDump {
  version: 1
  exportedAt: number
  nodes: StudyNode[]
  items: StudyItem[]
  reviews: ReviewItem[]
  logs: ReviewLogEntry[]
  settings: Settings | null
  blobs: { key: string; mime: string; size: number; dataBase64: string }[]
}

export async function loadAll() {
  const [nodes, items, reviews, logs] = await Promise.all([
    idbGetAll<StudyNode>(STORES.nodes),
    idbGetAll<StudyItem>(STORES.items),
    idbGetAll<ReviewItem>(STORES.reviews),
    idbGetAll<ReviewLogEntry>(STORES.logs),
  ])
  const settingsRec = await idbGet<{ key: string; value: Settings }>(STORES.meta, 'settings')
  return { nodes, items, reviews, logs, settings: settingsRec?.value ?? null }
}

export async function wipeEverything() {
  for (const s of Object.values(STORES)) {
    await idbClear(s)
  }
  for (const key of [...urlCache.keys()]) revokeUrl(key)
}
