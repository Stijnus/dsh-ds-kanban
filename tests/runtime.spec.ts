import { describe, expect, it, vi } from 'vitest'
import type { ISessions, SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { createRuntimeSource } from '../src/client/runtime.ts'

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
