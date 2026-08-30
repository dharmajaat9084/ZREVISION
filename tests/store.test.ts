import { expect, test, describe, beforeEach } from 'bun:test'
import { useApp } from '../src/lib/store'
import { idbPut, idbGetAll, idbGet, idbDelete, idbClear } from '../src/lib/db'

describe('Store and Database Fallback', () => {
  test('store initializes correctly even if indexedDB fails or is unavailable', async () => {
    const store = useApp.getState()
    await store.init()
    expect(useApp.getState().hydrated).toBe(true)
  })

  test('in-memory fallback allows creating and retrieving nodes', async () => {
    const store = useApp.getState()
    const nodeId = await store.createNode(null, 'subject', 'Physics 101')
    expect(nodeId).toBeTruthy()
    expect(useApp.getState().nodes[nodeId]).toBeDefined()
    expect(useApp.getState().nodes[nodeId].name).toBe('Physics 101')
  })

  test('direct db functions fallback to memory cleanly', async () => {
    await idbPut('nodes', { id: 'test-1', name: 'Math' })
    const fetched = await idbGet<{ id: string; name: string }>('nodes', 'test-1')
    expect(fetched).toBeDefined()
    expect(fetched?.name).toBe('Math')

    const all = await idbGetAll<{ id: string; name: string }>('nodes')
    expect(all.length).toBeGreaterThan(0)

    await idbDelete('nodes', 'test-1')
    const deleted = await idbGet('nodes', 'test-1')
    expect(deleted).toBeUndefined()
  })
})
