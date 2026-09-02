/** Observable Session-face fixtures for lifecycle tests and update benchmarks. */
import type { ISessions, SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** A stable face whose snapshots can change independently of its subscription. */
export function createFace() {
  const listeners = new Set<() => void>()
  return {
    state: { running: false, lastAgentError: null as string | null, queue: [] as unknown[] },
    reads: 0,
    disposals: 0,
    listeners,
    getSnapshot() { this.reads += 1; return this.state },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { this.disposals += 1; listeners.delete(listener) }
    },
    emit() { for (const listener of listeners) listener() },
  }
}

/** Create a list with stable bindings and replaceable faces for reconnect tests. */
export function createRuntimeHarness(count: number) {
  const ids = Array.from({ length: count }, (_, index) => `session-${index}` as SessionId)
  const faces = new Map(ids.map(id => [id, createFace()]))
  const list: SessionListState = {
    ids, byId: Object.fromEntries(ids.map(id => [id, {
      id, displayTitle: id, running: false, blank: true, updatedAt: 0,
    }])),
    current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }
  const listeners = new Set<() => void>()
  // Only the list and lifecycle methods consumed by RuntimeSource are modeled.
  const sessions = {
    list: {
      getSnapshot: () => list,
      subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    },
    binding: (id: SessionId) => faces.has(id) ? { session: faces.get(id)! } : undefined,
  } as unknown as ISessions
  return { sessions, ids, faces, list, emitList: () => { for (const listener of listeners) listener() } }
}
