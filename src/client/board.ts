/** Pure board projection from authoritative Harness Client snapshots. */
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-agent-presets/types'
import type {} from '@deepseek-ai/dsh-session-stats/client'
import type {} from '@deepseek-ai/dsh-token-meter/client'
import type { GoalProjection } from '@deepseek-ai/dsh-goal/client'
import type { KanbanSettings, ManualColumn, SortOrder } from '../settings.ts'

export const BOARD_COLUMNS = ['inbox', 'ready', 'running', 'waiting', 'blocked', 'idle', 'done'] as const
export type BoardColumn = typeof BOARD_COLUMNS[number]

/** Live per-session facts not carried by the list summary. */
export interface RuntimeSessionState {
  readonly running: boolean
  readonly lastAgentError: string | null
  readonly queueLength: number
}

/** Identity-stable snapshot built from Session faces. */
export type RuntimeSnapshot = Readonly<Record<string, RuntimeSessionState>>

/** One card projected for display. Undefined optional facts stay hidden. */
export interface BoardCard {
  readonly id: string
  readonly title: string
  readonly workspaceId?: string
  readonly workspace?: string
  readonly cwd?: string
  readonly column: BoardColumn
  readonly archived: boolean
  readonly running: boolean
  readonly waiting: boolean
  /** Owning interaction domain; unknown domains retain a generic attention label. */
  readonly interactionKind?: string
  readonly failure?: string
  /** Durable objective state; does not indicate live continuation eligibility. */
  readonly goal?: GoalProjection
  readonly queueLength?: number
  readonly updatedAt: number
  readonly blank: boolean
  readonly preset?: string
  readonly provider?: string
  readonly model?: string
  readonly steps?: number
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
  readonly totalTokens?: number
  readonly contextPercent?: number
  readonly subagents: number
}

export type ContextTone = 'ok' | 'warn' | 'critical'

/**
 * Map context-window usage to a progress tone for the card context bar.
 * @param percent - context-window usage as a percentage of capacity.
 * @param warningPercent - user-configured warning threshold from settings.
 * @returns `ok` below the threshold, `warn` at or above it, `critical` at full capacity.
 */
export function contextTone(percent: number, warningPercent: number): ContextTone {
  if (percent >= 100) return 'critical'
  if (percent >= warningPercent) return 'warn'
  return 'ok'
}

export interface BoardStats {
  readonly visible: number
  readonly running: number
  readonly waiting: number
  readonly blocked: number
  readonly completed: number
  readonly tokens: number
  readonly averageContext?: number
  readonly workspaces: number
}

export interface BoardFilters {
  readonly search: string
  readonly workspace: string
  readonly status: string
  readonly presetModel: string
  readonly activeOnly: boolean
  readonly includeArchived: boolean
  readonly sort: SortOrder
  readonly contextWarningPercent: number
}

function workspaceIndex(workspaces: readonly WorkspaceView[]): Map<string, WorkspaceView> {
  const result = new Map<string, WorkspaceView>()
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) result.set(sessionId, workspace)
  }
  return result
}

function contextPercent(summary: SessionSummary): number | undefined {
  const pressure = summary.projectionValues?.contextPressure
  const used = pressure?.projectedTokens ?? pressure?.pressureTokens
  const capacity = pressure?.contextWindow
  if (used === undefined || capacity === undefined || capacity <= 0) return undefined
  return Math.min(100, Math.max(0, used / capacity * 100))
}

function cardColumn(
  summary: SessionSummary,
  runtime: RuntimeSessionState | undefined,
  waiting: boolean,
  manual: ManualColumn | undefined,
): BoardColumn {
  if (waiting) return 'waiting'
  if (summary.running || runtime?.running === true) return 'running'
  if (runtime?.lastAgentError) return 'blocked'
  const goal = summary.projectionValues?.goal?.goal
  if (goal?.phase === 'blocked') return 'blocked'
  if ((runtime?.queueLength ?? 0) > 0) return 'idle'
  if (goal?.phase === 'complete') return 'done'
  if (goal !== undefined || !summary.blank) return 'idle'
  return manual ?? 'inbox'
}

/**
 * Project every authoritative Session list row into a board card.
 * @param sessions - live Client Session list.
 * @param workspaces - live Workspace and archive projection.
 * @param pending - effective user interaction per Session.
 * @param runtime - live Session-face facts unavailable on list summaries.
 * @param manual - plugin-owned Inbox/Ready placement for otherwise blank Sessions.
 * @returns cards in Session list order.
 */
export function projectCards(
  sessions: SessionListState,
  workspaces: WorkspaceSnapshot,
  pending: SessionPendingInteractionSnapshot,
  runtime: RuntimeSnapshot,
  manual: Readonly<Record<string, ManualColumn>>,
): BoardCard[] {
  const bySession = workspaceIndex(workspaces.items)
  const archived = new Set<string>(workspaces.archivedSessionIds)
  const childCount = new Map<string, number>()
  for (const summary of Object.values(sessions.byId)) {
    if (summary.parentId !== undefined) {
      childCount.set(summary.parentId, (childCount.get(summary.parentId) ?? 0) + 1)
    }
  }
  return sessions.ids.flatMap((id) => {
    const summary = sessions.byId[id]
    if (summary === undefined || summary.origin === 'subagent') return []
    const run = runtime[id]
    const workspace = bySession.get(id)
    const usage = summary.projectionValues?.tokenUsage
    const selection = summary.projectionValues?.modelSelection?.next
    const stats = summary.projectionValues?.sessionStats
    const goal = summary.projectionValues?.goal
    const inputTokens = usage === undefined
      ? undefined
      : usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const totalTokens = inputTokens === undefined ? undefined : inputTokens + usage!.outputTokens
    const context = contextPercent(summary)
    const isWaiting = pending.has(id)
    const interaction = pending.get(id)
    return [{
      id,
      title: summary.displayTitle,
      ...(workspace === undefined ? {} : { workspaceId: workspace.workspaceId, workspace: workspace.title }),
      ...(summary.cwd === undefined ? {} : { cwd: summary.cwd }),
      column: cardColumn(summary, run, isWaiting, manual[id]),
      archived: archived.has(id),
      running: summary.running || run?.running === true,
      waiting: isWaiting,
      ...(interaction === undefined ? {} : { interactionKind: interaction.kind }),
      ...(run?.lastAgentError ? { failure: run.lastAgentError } : {}),
      ...(goal == null ? {} : { goal }),
      ...(run === undefined ? {} : { queueLength: run.queueLength }),
      updatedAt: summary.updatedAt,
      blank: summary.blank,
      ...(typeof summary.projectionValues?.agentPreset === 'string'
        ? { preset: summary.projectionValues.agentPreset } : {}),
      ...(selection?.provider === undefined ? {} : { provider: selection.provider }),
      ...(selection?.model === undefined ? {} : { model: selection.model }),
      ...(stats === undefined ? {} : { steps: stats.steps }),
      ...(inputTokens === undefined ? {} : { inputTokens }),
      ...(usage === undefined || totalTokens === undefined ? {} : {
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        totalTokens,
      }),
      ...(context === undefined ? {} : { contextPercent: context }),
      subagents: sessions.subagentsByParent[id]?.entries.filter(entry => entry.kind === 'child').length ?? childCount.get(id) ?? 0,
    }]
  })
}

/**
 * Create a projection cache retaining unchanged cards for memoized renderers.
 * @returns a projector whose cache contains only the latest card set.
 */
export function createCardProjector(): typeof projectCards {
  let previous = new Map<string, BoardCard>()
  return (...args) => {
    const cards = projectCards(...args).map(card => {
      const cached = previous.get(card.id)
      if (cached === undefined) return card
      const keys = Object.keys(card) as (keyof BoardCard)[]
      return keys.length === Object.keys(cached).length
        && keys.every(key => card[key] === cached[key]) ? cached : card
    })
    previous = new Map(cards.map(card => [card.id, card]))
    return cards
  }
}

function searchable(card: BoardCard): string {
  return [
    card.id, card.title, card.workspace, card.cwd, card.preset, card.provider, card.model,
  ].filter((value): value is string => value !== undefined).join('\n').toLocaleLowerCase()
}

export type AttentionReason = 'approval' | 'question' | 'interaction' | 'failure' | 'blocked' | 'context'

/**
 * Choose the first actionable reason, with human interactions before diagnostics.
 * @param card - current card projection.
 * @param contextWarningPercent - configured context usage warning threshold.
 * @returns the reason to open the session, or undefined when no attention is needed.
 */
export function attentionReason(card: BoardCard, contextWarningPercent: number): AttentionReason | undefined {
  if (card.waiting || card.column === 'waiting') {
    switch (card.interactionKind) {
      case 'approval': return 'approval'
      case 'question': return 'question'
      // Interaction domains are extensible; their owning UI supplies the controls.
      default: return 'interaction'
    }
  }
  if (card.failure !== undefined) return 'failure'
  if (card.column === 'blocked' || card.goal?.goal.phase === 'blocked') return 'blocked'
  if ((card.contextPercent ?? 0) >= contextWarningPercent) return 'context'
  return undefined
}

/** A card needing operator attention under the configured context threshold. */
export function isAttention(card: BoardCard, contextWarningPercent: number): boolean {
  return attentionReason(card, contextWarningPercent) !== undefined
}

/**
 * Resolve a drag onto an Inbox/Ready column into manual placement.
 * @param id - the dragged card id read from the data transfer.
 * @param column - the column receiving the drop.
 * @param cards - all cards in the displayed board or workspace group.
 * @returns the manual column to store, or undefined when the drop must be ignored.
 */
export function dropColumn(
  id: string,
  column: BoardColumn,
  cards: readonly BoardCard[],
): ManualColumn | undefined {
  if (column !== 'inbox' && column !== 'ready') return undefined
  if (id === '') return undefined
  const card = cards.find(candidate => candidate.id === id)
  if (card === undefined || !card.blank || (card.column !== 'inbox' && card.column !== 'ready')) return undefined
  return column
}

function compareCards(a: BoardCard, b: BoardCard, sort: SortOrder): number {
  switch (sort) {
    case 'oldest': return a.updatedAt - b.updatedAt || a.id.localeCompare(b.id)
    case 'title': return a.title.localeCompare(b.title) || a.id.localeCompare(b.id)
    case 'tokens': return (b.totalTokens ?? -1) - (a.totalTokens ?? -1) || b.updatedAt - a.updatedAt
    case 'runtime':
    case 'cost':
    case 'recent': return b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)
    default: return assertNever(sort)
  }
}

/** Apply board filters and stable sorting without mutating the projection. */
export function filterCards(cards: readonly BoardCard[], filters: BoardFilters): BoardCard[] {
  const query = filters.search.trim().toLocaleLowerCase()
  return cards.filter(card =>
    (filters.includeArchived || !card.archived)
    && (query === '' || searchable(card).includes(query))
    && (filters.workspace === '' || card.workspaceId === filters.workspace)
    && (filters.status === ''
      || card.column === filters.status
      || (filters.status === 'attention' && isAttention(card, filters.contextWarningPercent)))
    && (filters.presetModel === ''
      || card.preset === filters.presetModel
      || card.model === filters.presetModel
      || card.provider === filters.presetModel)
    && (!filters.activeOnly || ['running', 'waiting', 'blocked'].includes(card.column)),
  ).sort((a, b) => compareCards(a, b, filters.sort))
}

/** Aggregate only metrics exposed by the current authoritative projections. */
export function aggregateStats(cards: readonly BoardCard[]): BoardStats {
  const contexts = cards.flatMap(card => card.contextPercent === undefined ? [] : [card.contextPercent])
  return {
    visible: cards.length,
    running: cards.filter(card => card.column === 'running').length,
    waiting: cards.filter(card => card.column === 'waiting').length,
    blocked: cards.filter(card => card.column === 'blocked').length,
    completed: cards.filter(card => card.column === 'done').length,
    tokens: cards.reduce((total, card) => total + (card.totalTokens ?? 0), 0),
    ...(contexts.length === 0
      ? {}
      : { averageContext: contexts.reduce((total, value) => total + value, 0) / contexts.length }),
    workspaces: new Set(cards.flatMap(card => card.workspaceId === undefined ? [] : [card.workspaceId])).size,
  }
}

/** Group cards by Workspace while retaining Ungrouped as a stable final key. */
export function groupCards(cards: readonly BoardCard[]): ReadonlyMap<string, readonly BoardCard[]> {
  const groups = new Map<string, BoardCard[]>()
  for (const card of cards) {
    const key = card.workspace ?? ''
    const group = groups.get(key) ?? []
    group.push(card)
    groups.set(key, group)
  }
  return groups
}

/** Build filter defaults from durable settings and a transient search query. */
export function filtersFromSettings(settings: KanbanSettings, search: string): BoardFilters {
  return {
    search,
    workspace: settings.workspace,
    status: settings.status,
    presetModel: settings.presetModel,
    activeOnly: settings.activeOnly,
    includeArchived: settings.includeArchived,
    sort: settings.sort,
    contextWarningPercent: settings.contextWarningPercent,
  }
}

function assertNever(value: never): never {
  throw new Error(`unknown sort order: ${String(value)}`)
}
