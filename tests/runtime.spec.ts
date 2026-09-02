import { describe, expect, it, vi } from 'vitest'
import type { ISessions, SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createRuntimeSource } from '../src/client/runtime.ts'
import { createFace, createRuntimeHarness } from './helpers/runtime-harness.ts'

const sid = (value: string) => value as SessionId

function listState(ids: string[]): SessionListState {
  return {
    ids: ids.map(sid),
    byId: Object.fromEntries(ids.map(id => [sid(id), {
      id: sid(id), displayTitle: id, running: false, blank: true, updatedAt: 0,
    }])),
    current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }
}

describe('runtime subscriptions', () => {
  it('reads only the changed face across bursts on a thousand-session board', () => {
    const harness = createRuntimeHarness(1000)
    const source = createRuntimeSource(harness.sessions)
    const previous = source.getSnapshot()
    const changed = vi.fn()
    source.subscribe(changed)
    for (const face of harness.faces.values()) face.reads = 0
    const activeIds = harness.ids.slice(0, 20)
    for (let tick = 0; tick < 50; tick += 1) {
      for (const id of activeIds) {
        const face = harness.faces.get(id)!
        face.state = { ...face.state, running: !face.state.running }
        face.emit()
      }
    }
    expect([...harness.faces.values()].reduce((sum, face) => sum + face.reads, 0)).toBe(1000)
    expect(changed).toHaveBeenCalledTimes(1000)
    expect(source.getSnapshot()[harness.ids[999]!]).toBe(previous[harness.ids[999]!])
    expect(previous[harness.ids[0]!]!.running).toBe(false)
    source.dispose()
  })

  it('ignores transcript-only emissions and tracks queue, running, and error changes', () => {
    const harness = createRuntimeHarness(2)
    const source = createRuntimeSource(harness.sessions)
    const before = source.getSnapshot()
    const changed = vi.fn()
    source.subscribe(changed)
    const face = harness.faces.get(harness.ids[0]!)!
    face.emit()
    expect(source.getSnapshot()).toBe(before)
    expect(changed).not.toHaveBeenCalled()
    face.state = { running: true, lastAgentError: null, queue: [{}] }
    face.emit()
    expect(source.getSnapshot()[harness.ids[0]!]).toEqual({ running: true, lastAgentError: null, queueLength: 1 })
    face.state = { running: false, lastAgentError: 'Disconnected', queue: [] }
    face.emit()
    expect(changed).toHaveBeenCalledTimes(2)
    expect(source.getSnapshot()[harness.ids[0]!]).toEqual({ running: false, lastAgentError: 'Disconnected', queueLength: 0 })
    source.dispose()
  })

  it('rebinds replaced faces and rejects callbacks from the previous connection or disposed source', () => {
    const harness = createRuntimeHarness(1)
    const id = harness.ids[0]!
    const oldFace = harness.faces.get(id)!
    const source = createRuntimeSource(harness.sessions)
    const lateOldCallback = [...oldFace.listeners][0]!
    const freshFace = createFace()
    freshFace.state.running = true
    harness.faces.set(id, freshFace)
    harness.emitList()
    expect(oldFace.disposals).toBe(1)
    expect(source.getSnapshot()[id]?.running).toBe(true)
    lateOldCallback()
    expect(source.getSnapshot()[id]?.running).toBe(true)
    const unchanged = source.getSnapshot()
    harness.emitList()
    expect(source.getSnapshot()).toBe(unchanged)
    const lateCallback = [...freshFace.listeners][0]!
    source.dispose()
    freshFace.state.running = false
    lateCallback()
    harness.emitList()
    expect(source.getSnapshot()).toBe(unchanged)
    expect(freshFace.disposals).toBe(1)
  })

  it('attaches a face that arrives after the list and drops removed sessions', () => {
    const harness = createRuntimeHarness(1)
    const id = harness.ids[0]!
    harness.faces.delete(id)
    const source = createRuntimeSource(harness.sessions)
    expect(source.getSnapshot()).toEqual({})
    const face = createFace()
    harness.faces.set(id, face)
    harness.emitList()
    expect(source.getSnapshot()[id]).toBeDefined()
    harness.list.ids = []
    harness.emitList()
    expect(source.getSnapshot()).toEqual({})
    expect(face.disposals).toBe(1)
    source.dispose()
  })

  it('publishes live face changes, reconciles list resets, and cleans up exactly once', () => {
    let list = listState(['one'])
    let listListener: (() => void) | undefined
    const disposeList = vi.fn()
    const faceListeners = new Map<string, () => void>()
    const faceDisposers = new Map<string, ReturnType<typeof vi.fn>>()
    const states: Record<string, { running: boolean; lastAgentError: string | null; queue: never[] }> = {
      one: { running: false, lastAgentError: null, queue: [] },
      two: { running: true, lastAgentError: null, queue: [] },
    }
    const binding = (id: SessionId) => {
      const key = String(id)
      const disposer = faceDisposers.get(key) ?? vi.fn()
      faceDisposers.set(key, disposer)
      return {
        session: {
          getSnapshot: () => states[key],
          subscribe: (listener: () => void) => { faceListeners.set(key, listener); return disposer },
        },
      }
    }
    const sessions = {
      list: {
        getSnapshot: () => list,
        subscribe: (listener: () => void) => { listListener = listener; return disposeList },
      },
      binding,
    } as unknown as ISessions
    const source = createRuntimeSource(sessions)
    const changed = vi.fn()
    source.subscribe(changed)
    states.one = { running: true, lastAgentError: null, queue: [] }
    faceListeners.get('one')?.()
    expect(source.getSnapshot().one?.running).toBe(true)
    expect(changed).toHaveBeenCalledTimes(1)

    list = listState(['two'])
    listListener?.()
    expect(source.getSnapshot()).toEqual({ two: { running: true, lastAgentError: null, queueLength: 0 } })
    expect(faceDisposers.get('one')).toHaveBeenCalledTimes(1)
    source.dispose()
    source.dispose()
    expect(disposeList).toHaveBeenCalledTimes(1)
    expect(faceDisposers.get('two')).toHaveBeenCalledTimes(1)
  })
})
