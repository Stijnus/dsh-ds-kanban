/** Host half of DS Kanban: register only the plugin-owned settings namespace. */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: loads the Context.settings declaration merging from the Service Definition.
import type {} from '@deepseek-ai/dsh-settings'
import { KanbanSettingsSchema } from './settings-schema.ts'
import { SETTINGS_NAMESPACE } from './settings.ts'

/** Cordis plugin name. */
export const name = 'ds-kanban'
/** The settings provider is optional so diagnostics can explain a memory-only deployment. */
export const inject: string[] = []

/**
 * Register the versioned DS Kanban preferences with the existing atomic settings provider.
 * @param ctx - Host context that may acquire the settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(SETTINGS_NAMESPACE, KanbanSettingsSchema)
  })
}

export {
  DEFAULT_SETTINGS,
  DENSITIES,
  MANUAL_COLUMNS,
  SETTINGS_NAMESPACE,
  SETTINGS_VERSION,
  SORT_ORDERS,
  TIME_MODES,
  decodeSettings,
  type Density,
  type KanbanSettings,
  type ManualColumn,
  type SortOrder,
  type TimeMode,
} from './settings.ts'
