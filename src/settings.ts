/** Durable DS Kanban settings shared by the Host schema and Client decoder. */

/** Plugin-owned settings namespace. */
export const SETTINGS_NAMESPACE = 'ds-kanban'
/** Current settings format. Unknown versions fail instead of being repaired. */
export const SETTINGS_VERSION = 1 as const

export const MANUAL_COLUMNS = ['inbox', 'ready'] as const
export type ManualColumn = typeof MANUAL_COLUMNS[number]
export const SORT_ORDERS = ['recent', 'oldest', 'title', 'runtime', 'tokens', 'cost'] as const
export type SortOrder = typeof SORT_ORDERS[number]
export const DENSITIES = ['compact', 'comfortable'] as const
export type Density = typeof DENSITIES[number]
export const TIME_MODES = ['relative', 'absolute'] as const
export type TimeMode = typeof TIME_MODES[number]

/** Host-durable board preferences. Authoritative session state never enters this record. */
export interface KanbanSettings {
  version: typeof SETTINGS_VERSION
  manual: Record<string, ManualColumn>
  workspace: string
  status: string
  presetModel: string
  activeOnly: boolean
  includeArchived: boolean
  groupByWorkspace: boolean
  sort: SortOrder
  density: Density
  timeMode: TimeMode
  contextWarningPercent: number
}

/** Settings used when the namespace has no user section. */
export const DEFAULT_SETTINGS: KanbanSettings = {
  version: SETTINGS_VERSION,
  manual: {},
  workspace: '',
  status: '',
  presetModel: '',
  activeOnly: false,
  includeArchived: false,
  groupByWorkspace: false,
  sort: 'recent',
  density: 'comfortable',
  timeMode: 'relative',
  contextWarningPercent: 80,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && values.some(candidate => candidate === value)
}

/**
 * Decode the redacted settings wire value without repairing malformed data.
 * @param value - settings section returned by the authenticated settings Remote.
 * @returns the accepted settings, or undefined so the Client preserves its last good snapshot.
 */
export function decodeSettings(value: unknown): KanbanSettings | undefined {
  if (!isRecord(value) || value.version !== SETTINGS_VERSION || !isRecord(value.manual)) return undefined
  const manual: Record<string, ManualColumn> = {}
  for (const [sessionId, column] of Object.entries(value.manual)) {
    if (!isMember(MANUAL_COLUMNS, column)) return undefined
    manual[sessionId] = column
  }
  const contextWarningPercent = value.contextWarningPercent
  if (
    typeof value.workspace !== 'string'
    || typeof value.status !== 'string'
    || typeof value.presetModel !== 'string'
    || typeof value.activeOnly !== 'boolean'
    || typeof value.includeArchived !== 'boolean'
    || typeof value.groupByWorkspace !== 'boolean'
    || !isMember(SORT_ORDERS, value.sort)
    || !isMember(DENSITIES, value.density)
    || !isMember(TIME_MODES, value.timeMode)
    || typeof contextWarningPercent !== 'number'
    || !Number.isInteger(contextWarningPercent)
    || contextWarningPercent < 1
    || contextWarningPercent > 100
  ) return undefined
  return {
    version: SETTINGS_VERSION,
    manual,
    workspace: value.workspace,
    status: value.status,
    presetModel: value.presetModel,
    activeOnly: value.activeOnly,
    includeArchived: value.includeArchived,
    groupByWorkspace: value.groupByWorkspace,
    sort: value.sort,
    density: value.density,
    timeMode: value.timeMode,
    contextWarningPercent,
  }
}
