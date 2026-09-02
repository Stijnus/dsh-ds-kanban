import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GoalId, GoalProjection, GoalPhase } from '@deepseek-ai/dsh-goal/client'
import {
  aggregateStats, attentionReason, contextTone, createCardProjector, dropColumn, filterCards, groupCards, projectCards, type BoardCard, type BoardColumn, type BoardFilters,
} from '../src/client/board.ts'
import { COLUMN_CARD_PAGE_SIZE, visibleColumnCards } from '../src/client/KanbanBoard.tsx'

const sid = (value: string) => value as SessionId
const goal = (phase: GoalPhase): GoalProjection => ({
  goal: {
    id: 'goal-one' as GoalId, revision: 1, phase, objective: 'Upgrade authentication', maxGoalRounds: 40,
    ...(phase === 'blocked' ? { blockedReason: { code: 'missing-input', message: 'Select an authentication provider' } } : {}),
  },
  roundsStarted: 12, createdAt: 1, updatedAt: 2,
})
const summary = (id: string, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), displayTitle: id, running: false, blank: true, updatedAt: 1, ...overrides,
})
const sessions = (rows: readonly SessionSummary[]): SessionListState => ({
  ids: rows.map(row => row.id),
  byId: Object.fromEntries(rows.map(row => [row.id, row])),
  current: undefined,
  phase: 'ready',
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
})
const workspaces: WorkspaceSnapshot = {
  phase: 'ready', state: 'idle', error: null,
  items: [{
    workspaceId: 'repo' as never,
    title: 'Harness',
    path: '/repo',
    sessionIds: [sid('idle'), sid('run'), sid('wait'), sid('fail'), sid('done'), sid('child')],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
  archivedSessionIds: [sid('done')],
}
const filters = (overrides: Partial<BoardFilters> = {}): BoardFilters => ({
  search: '', workspace: '', status: '', presetModel: '', activeOnly: false,
  includeArchived: false, sort: 'recent', contextWarningPercent: 80, ...overrides,
})

describe('board projection', () => {
  it('bounds each column DOM page without changing the authoritative card set', () => {
    const cards = Array.from({ length: 125 }, (_, index) => ({ id: String(index) })) as BoardCard[]
    expect(visibleColumnCards(cards, COLUMN_CARD_PAGE_SIZE)).toHaveLength(60)
    expect(visibleColumnCards(cards, COLUMN_CARD_PAGE_SIZE * 2)).toHaveLength(120)
    expect(cards).toHaveLength(125)
  })

  it('maps authoritative state with precedence over manual placement', () => {
    const pending: SessionPendingInteractionSnapshot = new Map([[sid('wait'), { kind: 'approval', key: 'approval:1', sessionId: sid('wait') }]])
    const rows = [
      summary('idle'),
      summary('run', { running: true }),
      summary('wait', { running: true }),
      summary('fail'),
      summary('done', { blank: false }),
      summary('child', { origin: 'subagent', parentId: sid('idle') }),
    ]
    const cards = projectCards(sessions(rows), workspaces, pending, {
      fail: { running: false, lastAgentError: 'provider unavailable', queueLength: 0 },
    }, { idle: 'ready', run: 'inbox', wait: 'inbox', fail: 'ready', done: 'ready' })
    expect(cards.map(card => [card.id, card.column])).toEqual([
      ['idle', 'ready'], ['run', 'running'], ['wait', 'waiting'], ['fail', 'blocked'], ['done', 'idle'],
    ])
    expect(cards[0]?.subagents).toBe(1)
    expect(cards.at(-1)?.archived).toBe(true)
  })

  it('keeps stopped, cancelled, and unread finished sessions idle without a completed objective', () => {
    const rows = ['stopped', 'cancelled', 'unread'].map(id => summary(id, { blank: false, completed: true }))
    const cards = projectCards(sessions(rows), workspaces, new Map(), {}, {})
    expect(cards.map(card => card.column)).toEqual(['idle', 'idle', 'idle'])
    expect(aggregateStats(cards).completed).toBe(0)
  })

  it('uses durable goal phases without treating an active goal as a running agent', () => {
    const phases = ['active', 'paused', 'blocked', 'complete'] as const
    const rows = phases.map(phase => summary(phase, { blank: false, projectionValues: { goal: goal(phase) } }))
    const cards = projectCards(sessions(rows), workspaces, new Map(), {}, { active: 'ready' })
    expect(cards.map(card => card.column)).toEqual(['idle', 'idle', 'blocked', 'done'])
    expect(cards[0]).toMatchObject({ running: false, goal: { roundsStarted: 12, goal: { maxGoalRounds: 40 } } })
    expect(cards[2]?.goal?.goal.blockedReason?.message).toBe('Select an authentication provider')
    expect(aggregateStats(cards).completed).toBe(1)
  })

  it('lets current execution, failures, pending input, and queued work override completed goals', () => {
    const row = summary('task', { blank: false, projectionValues: { goal: goal('complete') } })
    const project = (running: boolean, lastAgentError: string | null, queueLength: number, pending = new Map()) =>
      projectCards(sessions([row]), workspaces, pending, { task: { running, lastAgentError, queueLength } }, {})[0]!
    expect(project(true, null, 0).column).toBe('running')
    expect(project(false, 'Failed', 0).column).toBe('blocked')
    expect(project(false, null, 1)).toMatchObject({ column: 'idle', queueLength: 1 })
    expect(project(true, null, 0, new Map([[sid('task'), { key: 'q1', kind: 'question', sessionId: sid('task') }]])).column).toBe('waiting')
  })

  it('clears removed goal and failure fields while retaining unrelated card identities', () => {
    const project = createCardProjector()
    const first = sessions([
      summary('one', { blank: false, projectionValues: { goal: goal('blocked') } }), summary('two'),
    ])
    const before = project(first, workspaces, new Map(), { one: { running: false, lastAgentError: 'failure', queueLength: 0 } }, {})
    const after = project(sessions([summary('one', { blank: false, projectionValues: { goal: null } }), first.byId[sid('two')]!]), workspaces, new Map(), {}, {})
    expect(after[0]).not.toBe(before[0])
    expect(after[0]).not.toHaveProperty('goal')
    expect(after[0]).not.toHaveProperty('failure')
    expect(after[0]?.column).toBe('idle')
    expect(after[1]).toBe(before[1])
  })

  it('recomputes attention when an interaction is replaced or cleared', () => {
    const row = summary('one', { running: true })
    const reason = (kind?: string) => {
      const pending = new Map(kind === undefined ? [] : [[sid('one'), { key: kind, kind, sessionId: sid('one') }]])
      return attentionReason(projectCards(sessions([row]), workspaces, pending, {}, {})[0]!, 80)
    }
    expect(reason('approval')).toBe('approval')
    expect(reason('question')).toBe('question')
    expect(reason('external-domain')).toBe('interaction')
    expect(reason()).toBeUndefined()
  })

  it('projects model, token, step, and context facts without inventing missing metrics', () => {
    const cards = projectCards(sessions([summary('metrics', {
      projectionValues: {
        modelSelection: { lastUsed: null, next: { provider: 'deepseek', model: 'chat' } },
        agentPreset: 'headless',
        sessionStats: { steps: 3 } as never,
        tokenUsage: { uncachedInputTokens: 10, cacheReadTokens: 4, cacheWriteTokens: 2, outputTokens: 5 } as never,
        contextPressure: { projectedTokens: 50, pressureTokens: 40, contextWindow: 100 } as never,
      },
    })]), { ...workspaces, items: [], archivedSessionIds: [] }, new Map(), {}, {})
    expect(cards[0]).toMatchObject({
      provider: 'deepseek', model: 'chat', preset: 'headless', steps: 3,
      inputTokens: 16, outputTokens: 5, totalTokens: 21, contextPercent: 50,
    })
    expect(cards[0]).not.toHaveProperty('cost')
    expect(cards[0]).not.toHaveProperty('toolCalls')
  })

  it('filters archived and attention cards, searches, groups, sorts, and aggregates', () => {
    const cards: BoardCard[] = [
      { id: 'a', title: 'Alpha', workspaceId: 'one', workspace: 'One', column: 'waiting', archived: false, running: false, waiting: true, updatedAt: 10, blank: false, totalTokens: 20, contextPercent: 20, subagents: 0 },
      { id: 'b', title: 'Beta', workspaceId: 'two', workspace: 'Two', column: 'done', archived: true, running: false, waiting: false, updatedAt: 30, blank: false, totalTokens: 5, contextPercent: 90, subagents: 0 },
      { id: 'c', title: 'Gamma', workspaceId: 'one', workspace: 'One', column: 'running', archived: false, running: true, waiting: false, updatedAt: 20, blank: false, model: 'reasoner', subagents: 0 },
    ]
    expect(filterCards(cards, filters()).map(card => card.id)).toEqual(['c', 'a'])
    expect(filterCards(cards, filters({ includeArchived: true, status: 'attention' })).map(card => card.id)).toEqual(['b', 'a'])
    expect(filterCards(cards, filters({ search: 'reasoner' })).map(card => card.id)).toEqual(['c'])
    expect(filterCards(cards, filters({ sort: 'tokens' })).map(card => card.id)).toEqual(['a', 'c'])
    expect([...groupCards(cards).keys()]).toEqual(['One', 'Two'])
    expect(aggregateStats(cards)).toMatchObject({ visible: 3, running: 1, waiting: 1, completed: 1, tokens: 25, averageContext: 55, workspaces: 2 })
  })

  it('filters by workspace, status, preset/model/provider, and active-only', () => {
    const cards: BoardCard[] = [
      { id: 'a', title: 'A', workspaceId: 'one', column: 'running', archived: false, running: true, waiting: false, updatedAt: 10, blank: false, preset: 'headless', model: 'reasoner', subagents: 0 },
      { id: 'b', title: 'B', workspaceId: 'two', column: 'waiting', archived: false, running: false, waiting: true, updatedAt: 20, blank: false, model: 'chat', subagents: 0 },
      { id: 'c', title: 'C', workspaceId: 'one', column: 'done', archived: false, running: false, waiting: false, updatedAt: 30, blank: false, provider: 'deepseek', subagents: 0 },
    ]
    expect(filterCards(cards, filters({ workspace: 'one' })).map(card => card.id)).toEqual(['c', 'a'])
    expect(filterCards(cards, filters({ status: 'waiting' })).map(card => card.id)).toEqual(['b'])
    expect(filterCards(cards, filters({ presetModel: 'headless' })).map(card => card.id)).toEqual(['a'])
    expect(filterCards(cards, filters({ presetModel: 'reasoner' })).map(card => card.id)).toEqual(['a'])
    expect(filterCards(cards, filters({ presetModel: 'deepseek' })).map(card => card.id)).toEqual(['c'])
    expect(filterCards(cards, filters({ activeOnly: true })).map(card => card.id)).toEqual(['b', 'a'])
  })
})

describe('drop placement', () => {
  const card = (id: string, column: BoardColumn, blank = true): BoardCard => ({
    id, title: id, column, archived: false, running: false, waiting: false, updatedAt: 1, blank, subagents: 0,
  })
  it('lands known blank Inbox/Ready cards and ignores every other drop', () => {
    const cards = [card('blank', 'inbox'), card('worked', 'done', false), card('run', 'running', false)]
    expect(dropColumn('blank', 'ready', cards)).toBe('ready')
    expect(dropColumn('new', 'inbox', cards)).toBeUndefined()
    expect(dropColumn('worked', 'inbox', cards)).toBeUndefined()
    expect(dropColumn('run', 'ready', cards)).toBeUndefined()
    expect(dropColumn('', 'ready', cards)).toBeUndefined()
    expect(dropColumn('blank', 'running', cards)).toBeUndefined()
    expect(dropColumn('blank', 'waiting', cards)).toBeUndefined()
    expect(dropColumn('blank', 'blocked', cards)).toBeUndefined()
    expect(dropColumn('blank', 'done', cards)).toBeUndefined()
  })
})

describe('context progress tone', () => {
  it('stays ok below the warning threshold and escalates at and above it', () => {
    expect(contextTone(0, 80)).toBe('ok')
    expect(contextTone(79, 80)).toBe('ok')
    expect(contextTone(80, 80)).toBe('warn')
    expect(contextTone(95, 80)).toBe('warn')
    expect(contextTone(99, 80)).toBe('warn')
  })

  it('treats full capacity as critical regardless of the threshold', () => {
    expect(contextTone(100, 80)).toBe('critical')
    expect(contextTone(100, 100)).toBe('critical')
  })
})
