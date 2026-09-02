/** Live Session-face projection for facts absent from global list rows. */
import type { ISessions, SessionFace, SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
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
  const subscriptions = new Map<string, SessionSubscription>()
  let snapshot: RuntimeSnapshot = {}
  let disposed = false

  const publish = (): void => {
    const next: Record<string, RuntimeSessionState> = {}
    for (const [id, entry] of subscriptions) next[id] = runtimeState(entry.face)
    if (JSON.stringify(next) === JSON.stringify(snapshot)) return
    snapshot = next
    notifySubscribers(listeners, '[ds-kanban/runtime]')
  }

  const reconcile = (list: SessionListState): void => {
    const ids = new Set<string>(list.ids)
    for (const [id, entry] of subscriptions) {
      if (ids.has(id)) continue
      entry.dispose()
      subscriptions.delete(id)
    }
    for (const id of list.ids) {
      if (subscriptions.has(id)) continue
      const face = sessions.binding(id)?.session
      if (face === undefined) continue
      subscriptions.set(id, { face, dispose: face.subscribe(publish) })
    }
    publish()
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
