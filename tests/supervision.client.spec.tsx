// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GoalId, GoalPhase, GoalProjection } from '@deepseek-ai/dsh-goal/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import { createCardProjector, projectCards } from '../src/client/board.ts'
import { TaskCard } from '../src/client/KanbanBoard.tsx'
import type { KanbanBoardProps } from '../src/client/contracts.ts'
import { en, zh, type KanbanKey } from '../src/client/locales.ts'
import { DEFAULT_SETTINGS } from '../src/settings.ts'
import { exportJson } from '../src/client/export.ts'

afterEach(cleanup)

const id = 'task-one' as SessionId
const workspaces = { phase: 'ready', state: 'idle', error: null, items: [], archivedSessionIds: [] } as const
const rows = (overrides: Partial<SessionSummary> = {}): SessionListState => ({
  ids: [id], byId: { [id]: { id, displayTitle: 'Upgrade authentication', blank: false, running: false, updatedAt: 1, ...overrides } },
  phase: 'ready', current: undefined, subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
})
const goal = (phase: GoalPhase): GoalProjection => ({
  goal: {
    id: 'objective-one' as GoalId, revision: 1, objective: 'Preserve existing sign-in behavior', phase, maxGoalRounds: 40,
    ...(phase === 'blocked' ? { blockedReason: { code: 'missing-provider', message: 'Choose the authentication provider' } } : {}),
  },
  roundsStarted: 12, createdAt: 1, updatedAt: 2,
})
const translate = (dictionary: Record<KanbanKey, string>): KanbanBoardProps['t'] => (key, values) => {
  const copy: Record<string, string> = dictionary
  let value = copy[key]
  if (value === undefined) throw new Error(`Missing translation: ${key}`)
  for (const [name, replacement] of Object.entries(values ?? {})) value = value.replaceAll(`{${name}}`, String(replacement))
  return value
}
function props(dictionary: Record<KanbanKey, string> = en): KanbanBoardProps {
  // TaskCard consumes only translation, session navigation, and card actions.
  return {
    t: translate(dictionary), openTask: vi.fn(), actions: { setError: vi.fn() },
    archiveTask: vi.fn(), cancelTask: vi.fn(), copyTaskId: vi.fn(),
  } as unknown as KanbanBoardProps
}

describe('agent supervision presentation', () => {
  it.each([['English', en], ['Chinese', zh]] as const)('records goal lifecycle copy in %s', (_locale, dictionary) => {
    const cardProps = props(dictionary)
    const presentation = []
    for (const phase of ['active', 'paused', 'blocked', 'complete'] as const) {
      const card = projectCards(rows({ projectionValues: { goal: goal(phase) } }), workspaces, new Map(), {}, {})[0]!
      const view = render(<TaskCard card={card} settings={DEFAULT_SETTINGS} props={cardProps} />)
      presentation.push({
        column: card.column,
        goal: [...view.container.querySelector('.dsk-goal')!.children].map(element => element.textContent),
        action: view.container.querySelector('.dsk-attention')?.textContent ?? null,
      })
      expect(view.queryByRole('progressbar')).toBeNull()
      view.unmount()
    }
    expect(presentation).toMatchSnapshot()
  })

  it('opens existing sessions for attention without answering or retaining an obsolete request', () => {
    const cardProps = props()
    const current = (kind: string) => projectCards(rows({ running: true }), workspaces,
      new Map([[id, { sessionId: id, kind, key: `request-${kind}` }]]), {}, {})[0]!
    const view = render(<TaskCard card={current('approval')} settings={DEFAULT_SETTINGS} props={cardProps} />)
    expect(screen.getByRole('button', { name: en['attention.approval'] })).toBeDefined()
    view.rerender(<TaskCard card={current('question')} settings={DEFAULT_SETTINGS} props={cardProps} />)
    expect(screen.queryByRole('button', { name: en['attention.approval'] })).toBeNull()
    const action = screen.getByRole('button', { name: en['attention.question'] })
    fireEvent.keyDown(action, { key: 'Enter' })
    expect(cardProps.openTask).not.toHaveBeenCalled()
    fireEvent.click(action)
    expect(cardProps.openTask).toHaveBeenCalledExactlyOnceWith(id)
    const cleared = projectCards(rows({ running: true }), workspaces, new Map(), {}, {})[0]!
    view.rerender(<TaskCard card={cleared} settings={DEFAULT_SETTINGS} props={cardProps} />)
    expect(view.container.querySelector('.dsk-attention')).toBeNull()
  })

  it('does not rerender a card for unrelated session updates', () => {
    const cardProps = props()
    cardProps.t = vi.fn(cardProps.t)
    const project = createCardProjector()
    const sessions = rows()
    const card = project(sessions, workspaces, new Map(), {}, {})[0]!
    const view = render(<TaskCard card={card} settings={DEFAULT_SETTINGS} props={cardProps} />)
    vi.mocked(cardProps.t).mockClear()
    const retained = project(sessions, workspaces, new Map(), { other: { running: true, lastAgentError: null, queueLength: 0 } }, {})[0]!
    view.rerender(<TaskCard card={retained} settings={DEFAULT_SETTINGS} props={cardProps} />)
    expect(cardProps.t).not.toHaveBeenCalled()
  })

  it('omits goal text and blocker explanations from exports', () => {
    const cards = projectCards(rows({ projectionValues: { goal: goal('blocked') } }), workspaces, new Map(), {}, {})
    const exported = exportJson(cards)
    expect(exported).not.toContain('Preserve existing sign-in behavior')
    expect(exported).not.toContain('Choose the authentication provider')
    expect(exported).toContain('blocked')
  })
})
