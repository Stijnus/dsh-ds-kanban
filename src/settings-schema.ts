/** Host-only validation schema for DS Kanban preferences. */
import z from '@deepseek-ai/schemastery'
import {
  DENSITIES, MANUAL_COLUMNS, SETTINGS_VERSION, SORT_ORDERS, TIME_MODES, type KanbanSettings,
} from './settings.ts'

/** Versioned schema enforced before the settings provider commits an atomic write. */
export const KanbanSettingsSchema: z<KanbanSettings> = z.object({
  version: z.const(SETTINGS_VERSION).default(SETTINGS_VERSION),
  manual: z.dict(z.union([...MANUAL_COLUMNS])).default({}),
  workspace: z.string().default(''),
  status: z.string().default(''),
  presetModel: z.string().default(''),
  activeOnly: z.boolean().default(false),
  includeArchived: z.boolean().default(false),
  groupByWorkspace: z.boolean().default(false),
  sort: z.union([...SORT_ORDERS]).default('recent'),
  density: z.union([...DENSITIES]).default('comfortable'),
  timeMode: z.union([...TIME_MODES]).default('relative'),
  contextWarningPercent: z.number().step(1).min(1).max(100).default(80),
})
