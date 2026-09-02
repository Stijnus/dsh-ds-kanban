/** Slot and injected contracts for DS Kanban's two shell contributions. */
import type { ConnectionGenerationState } from '@deepseek-ai/dsh-client-connection/client'
import type { HostObservable, PropsHooks, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { KanbanSettings, ManualColumn } from '../settings.ts'
import type { RuntimeSnapshot } from './board.ts'
import type { NewTaskInput, PresetOption } from './actions.ts'
import type { createKanbanViewStore } from './store.ts'

export type { PresetOption } from './actions.ts'

export type KanbanHooks = {
  runtime: HostObservable<RuntimeSnapshot>
  connectionGeneration: ConnectionGenerationState
  kanbanSettings: SettingsScope<KanbanSettings>
}

export interface KanbanInjected {
  hooks: KanbanHooks
  openTask: (sessionId: SessionId) => void
  refresh: () => Promise<void>
  archiveTask: (sessionId: SessionId) => Promise<void>
  cancelTask: (sessionId: SessionId) => Promise<void>
  copyTaskId: (sessionId: SessionId) => Promise<void>
  createTask: (input: NewTaskInput) => Promise<SessionId>
  listPresets: () => Promise<readonly PresetOption[]>
  setSetting: <K extends keyof KanbanSettings>(field: K, value: KanbanSettings[K]) => Promise<void>
  setManual: (sessionId: SessionId, column: ManualColumn) => Promise<void>
}

export type KanbanBoardProps = PropsRuntime<'shell.overlay'>
  & PropsStore<ReturnType<typeof createKanbanViewStore>>
  & PropsHooks<KanbanHooks>
  & Omit<KanbanInjected, 'hooks'>
  & PropsLocale<'dsKanban'>

export type SidebarActionProps = PropsRuntime<'sidebar.footer.action'>
  & PropsStore<ReturnType<typeof createKanbanViewStore>>
  & PropsHooks<Pick<KanbanHooks, 'runtime' | 'kanbanSettings'>>
  & PropsLocale<'dsKanban'>

/** Narrow Workspace form ids without exposing a raw string to Host calls. */
export function workspaceId(value: string): WorkspaceId | undefined {
  return value === '' ? undefined : value as WorkspaceId
}
