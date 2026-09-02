import { Context } from "@deepseek-ai/cordis";
//#region src/settings.d.ts
/** Durable DS Kanban settings shared by the Host schema and Client decoder. */
/** Plugin-owned settings namespace. */
declare const SETTINGS_NAMESPACE = "ds-kanban";
/** Current settings format. Unknown versions fail instead of being repaired. */
declare const SETTINGS_VERSION: 1;
declare const MANUAL_COLUMNS: readonly ["inbox", "ready"];
type ManualColumn = typeof MANUAL_COLUMNS[number];
declare const SORT_ORDERS: readonly ["recent", "oldest", "title", "runtime", "tokens", "cost"];
type SortOrder = typeof SORT_ORDERS[number];
declare const DENSITIES: readonly ["compact", "comfortable"];
type Density = typeof DENSITIES[number];
declare const TIME_MODES: readonly ["relative", "absolute"];
type TimeMode = typeof TIME_MODES[number];
/** Host-durable board preferences. Authoritative session state never enters this record. */
interface KanbanSettings {
  version: typeof SETTINGS_VERSION;
  manual: Record<string, ManualColumn>;
  workspace: string;
  status: string;
  presetModel: string;
  activeOnly: boolean;
  includeArchived: boolean;
  groupByWorkspace: boolean;
  sort: SortOrder;
  density: Density;
  timeMode: TimeMode;
  contextWarningPercent: number;
}
/** Settings used when the namespace has no user section. */
declare const DEFAULT_SETTINGS: KanbanSettings;
/**
 * Decode the redacted settings wire value without repairing malformed data.
 * @param value - settings section returned by the authenticated settings Remote.
 * @returns the accepted settings, or undefined so the Client preserves its last good snapshot.
 */
declare function decodeSettings(value: unknown): KanbanSettings | undefined;
//#endregion
//#region src/index.d.ts
/** Cordis plugin name. */
declare const name = "ds-kanban";
/** The settings provider is optional so diagnostics can explain a memory-only deployment. */
declare const inject: string[];
/**
 * Register the versioned DS Kanban preferences with the existing atomic settings provider.
 * @param ctx - Host context that may acquire the settings service.
 */
declare function apply(ctx: Context): void;
//#endregion
export { DEFAULT_SETTINGS, DENSITIES, type Density, type KanbanSettings, MANUAL_COLUMNS, type ManualColumn, SETTINGS_NAMESPACE, SETTINGS_VERSION, SORT_ORDERS, type SortOrder, TIME_MODES, type TimeMode, apply, decodeSettings, inject, name };