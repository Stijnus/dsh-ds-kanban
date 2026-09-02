/** Live Session-face projection for facts absent from global list rows. */
import type { ISessions, SessionFace, SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { notifySubscribers, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { RuntimeSessionState, RuntimeSnapshot } from './board.ts'

interface SessionSubscription {
  readonly face: SessionFace
  readonly dispose: () => void
}

function runtimeState(face: SessionFace): RuntimeSessionState {
  const snapshot = face.getSnapshot()
  return {
    running: snapshot.running,
    lastAgentError: snapshot.lastAgentError,
    queueLength: snapshot.queue.length,
  }
}

/** Runtime source plus lifecycle disposer. */
export interface RuntimeSource extends ObservableSnapshot<RuntimeSnapshot> {
  /** Remove list and per-session subscriptions. */
  dispose(): void
}

/**
 * Observe lightweight Session lifecycle faces without opening transcript windows.
 * @param sessions - Client Sessions service.
 * @returns identity-stable runtime snapshot source.
 */
export function createRuntimeSource(sessions: ISessions): RuntimeSource {
  const listeners = new Set<() => void>()
  const subscriptions = new Map<SessionId, SessionSubscription>()
  let snapshot: RuntimeSnapshot = {}
  let disposed = false

  const update = (id: SessionId, face: SessionFace): void => {
    if (disposed || subscriptions.get(id)?.face !== face) return
    const next = runtimeState(face)
    const previous = snapshot[id]
    if (previous?.running === next.running
      && previous.lastAgentError === next.lastAgentError
      && previous.queueLength === next.queueLength) return
    snapshot = { ...snapshot, [id]: next }
    notifySubscribers(listeners, '[ds-kanban/runtime]')
  }

  const reconcile = (list: SessionListState): void => {
    if (disposed) return
    let next: Record<string, RuntimeSessionState> | undefined
    const ids = new Set<string>(list.ids)
    for (const [id, entry] of subscriptions) {
      if (ids.has(id) && sessions.binding(id)?.session === entry.face) continue
      entry.dispose()
      subscriptions.delete(id)
      next ??= { ...snapshot }
      delete next[id]
    }
    for (const id of list.ids) {
      if (subscriptions.has(id)) continue
      const face = sessions.binding(id)?.session
      if (face === undefined) continue
      subscriptions.set(id, { face, dispose: face.subscribe(() => { update(id, face) }) })
      next ??= { ...snapshot }
      next[id] = runtimeState(face)
    }
    if (next === undefined) return
    snapshot = next
    notifySubscribers(listeners, '[ds-kanban/runtime]')
  }

  const disposeList = sessions.list.subscribe(() => { reconcile(sessions.list.getSnapshot()) })
  reconcile(sessions.list.getSnapshot())
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    dispose() {
      if (disposed) return
      disposed = true
      disposeList()
      for (const entry of subscriptions.values()) entry.dispose()
      subscriptions.clear()
      listeners.clear()
    },
  }
}
