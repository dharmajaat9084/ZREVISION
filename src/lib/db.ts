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
let useMemoryFallback = false
const memoryStores = new Map<string, Map<string, unknown>>()

function getMemoryStore(store: string): Map<string, unknown> {
  let m = memoryStores.get(store)
  if (!m) {
    m = new Map<string, unknown>()
    memoryStores.set(store, m)
  }
  return m
}

function getItemKey(value: unknown): string {
  if (value && typeof value === 'object') {
    if ('id' in value && value.id != null) return String(value.id)
    if ('key' in value && value.key != null) return String(value.key)
  }
  return String(value)
}

function openDB(): Promise<IDBDatabase> {
  if (useMemoryFallback) {
    return Promise.reject(new Error('Using in-memory fallback store'))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      useMemoryFallback = true
      return reject(new Error('IndexedDB is not supported or unavailable'))
    }
    try {
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
      req.onerror = () => {
        useMemoryFallback = true
        reject(req.error || new Error('Failed to open IndexedDB'))
      }
    } catch (err) {
      useMemoryFallback = true
      reject(err)
    }
  })
  return dbPromise
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  if (useMemoryFallback) {
    throw new Error('Using memory fallback')
  }
  try {
    const db = await openDB()
    return await new Promise<T>((resolve, reject) => {
      try {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const req = fn(s)
        t.oncomplete = () => resolve((req as IDBRequest<T>)?.result ?? (undefined as unknown as T))
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      } catch (err) {
        reject(err)
      }
    })
  } catch (err) {
    useMemoryFallback = true
    throw err
  }
}

/* ── generic helpers ──────────────────────────────────────────────── */

export async function idbGetAll<T>(store: string): Promise<T[]> {
  try {
    const res = await tx<T[]>(store, 'readonly', (s) => s.getAll())
    return res ?? []
  } catch {
    const mem = getMemoryStore(store)
    return Array.from(mem.values()) as T[]
  }
}

export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  try {
    return await tx<T | undefined>(store, 'readonly', (s) => s.get(key))
  } catch {
    const mem = getMemoryStore(store)
    return mem.get(key) as T | undefined
  }
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const k = getItemKey(value)
  const mem = getMemoryStore(store)
  mem.set(k, value)
  try {
    await tx(store, 'readwrite', (s) => {
      s.put(value as unknown as Record<string, unknown>)
    })
  } catch {
    /* safely fallback to memory store (already saved) */
  }
}

export async function idbDelete(store: string, key: string): Promise<void> {
  const mem = getMemoryStore(store)
  mem.delete(key)
  try {
    await tx(store, 'readwrite', (s) => {
      s.delete(key)
    })
  } catch {
    /* fallback to memory store */
  }
}

export async function idbClear(store: string): Promise<void> {
  const mem = getMemoryStore(store)
  mem.clear()
  try {
    await tx(store, 'readwrite', (s) => {
      s.clear()
    })
  } catch {
    /* fallback to memory store */
  }
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
