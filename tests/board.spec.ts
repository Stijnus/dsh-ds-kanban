import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  aggregateStats, contextTone, dropColumn, filterCards, groupCards, projectCards, type BoardCard, type BoardColumn, type BoardFilters,
} from '../src/client/board.ts'
import { COLUMN_CARD_PAGE_SIZE, visibleColumnCards } from '../src/client/KanbanBoard.tsx'

const sid = (value: string) => value as SessionId
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
    const pending: SessionPendingInteractionSnapshot = new Map([[sid('wait'), { type: 'approval' } as never]])
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
      ['idle', 'ready'], ['run', 'running'], ['wait', 'waiting'], ['fail', 'blocked'], ['done', 'done'],
    ])
    expect(cards[0]?.subagents).toBe(1)
    expect(cards.at(-1)?.archived).toBe(true)
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
  it('lands blank or unknown cards on Inbox/Ready and ignores every other drop', () => {
    const cards = [card('blank', 'inbox'), card('worked', 'done', false), card('run', 'running', false)]
    expect(dropColumn('blank', 'ready', cards)).toBe('ready')
    expect(dropColumn('new', 'inbox', cards)).toBe('inbox')
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
