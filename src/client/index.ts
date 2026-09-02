/** Browser half of DS Kanban: shell contributions over existing Client services. */
import type { Context } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-store'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { TaskCreator, fetchPresets } from './actions.ts'
import type { KanbanInjected, PresetOption } from './contracts.ts'
import { KanbanBoard } from './KanbanBoard.tsx'
import { en, zh, type KanbanKey } from './locales.ts'
import { createRuntimeSource } from './runtime.ts'
import { SidebarAction } from './SidebarAction.tsx'
import { createKanbanViewStore } from './store.ts'
import { styles } from './styles.ts'
import { DEFAULT_SETTINGS, SETTINGS_NAMESPACE, decodeSettings, type KanbanSettings, type ManualColumn } from '../settings.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** DS Kanban board and action copy. */
    dsKanban: KanbanKey
  }
}

/** Services the browser plugin consumes. */
export const inject = [
  'slots', 'sessions', 'workspaces', 'locale', 'connection', 'settingsScope', 'remote',
  'remote.agentPresets',
]

/**
 * Register the sidebar action, full-shell overlay, dictionaries, styles, and live sources.
 * @param ctx - Client root Context.
 */
export function apply(ctx: Context): void {
  const sessions = ctx.get('sessions') as ISessions
  const workspaces = ctx.get('workspaces') as IWorkspaces
  const connection = ctx.get('connection') as ConnectionHandle
  const settings = ctx.settingsScope.bind<KanbanSettings>({
    namespace: SETTINGS_NAMESPACE,
    decode: decodeSettings,
  })
  const remote = ctx.remote
  const runtime = createRuntimeSource(sessions)
  const viewStore = createKanbanViewStore()
  type ViewActions = BoundActions<typeof viewStore>
  const creator = new TaskCreator({ sessions, agentPresets: remote.agentPresets })

  ctx.effect(() => () => { runtime.dispose() }, 'ds-kanban: runtime subscriptions')
  ctx.effect(() => ctx.locale.register('dsKanban', { en, zh }), 'ds-kanban: dictionaries')
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'ds-kanban'
    tag.textContent = styles
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'ds-kanban: styles')

  const setSetting: KanbanInjected['setSetting'] = async (field, value) => {
    await settings.set(field, value)
  }
  const setManual = async (sessionId: Parameters<KanbanInjected['setManual']>[0], column: ManualColumn): Promise<void> => {
    const current = settings.getSnapshot().value ?? DEFAULT_SETTINGS
    await settings.set('manual', { ...current.manual, [sessionId]: column })
  }
  const listPresets = (): Promise<readonly PresetOption[]> => fetchPresets(remote.agentPresets)

  const injected = (viewActions: ViewActions): KanbanInjected => {
    return {
      hooks: {
        runtime,
        connectionGeneration: connection.generation,
        kanbanSettings: settings,
      },
      openTask: (sessionId) => {
        sessions.open(sessionId)
        viewActions.close()
      },
      openSubagent: address => {
        sessions.openSubagent(address)
        viewActions.close()
      },
      setSubagentCatalogOpen: (id, open) => sessions.setSubagentCatalogOpen(id, open),
      refreshSubagents: id => sessions.refreshSubagents(id),
      refresh: () => sessions.refresh(),
      archiveTask: async (sessionId) => {
        await workspaces.archiveSession(sessionId)
      },
      cancelTask: async (sessionId) => {
        const session = sessions.binding(sessionId)?.session
        if (session === undefined) throw new Error(`unknown task "${String(sessionId)}"`)
        const result = await session.cancel()
        if (!result.ok) throw new Error(result.error.message)
      },
      copyTaskId: async (sessionId) => { await navigator.clipboard.writeText(sessionId) },
      createTask: input => creator.create(input),
      listPresets,
      setSetting,
      setManual,
    }
  }

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'ds-kanban',
    order: -10,
    store: viewStore,
    locale: 'dsKanban',
    inject: () => ({
      hooks: { runtime, kanbanSettings: settings },
    }),
  }, SidebarAction))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'ds-kanban',
    order: 10,
    store: viewStore,
    locale: 'dsKanban',
    inject: injected,
  }, KanbanBoard))
}
