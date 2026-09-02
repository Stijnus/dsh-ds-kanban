/** Sidebar footer action opening the shared DS Kanban overlay. */
import { useMemo } from 'react'
import { IconChecklistOutline14, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { isAttention, projectCards } from './board.ts'
import type { SidebarActionProps } from './contracts.ts'
import { DEFAULT_SETTINGS } from '../settings.ts'

export function SidebarAction(props: SidebarActionProps) {
  const { t, wide, useSessions, useWorkspaces, useSessionPendingInteraction } = props
  const settings = props.useKanbanSettings(snapshot => snapshot.value ?? DEFAULT_SETTINGS)
  const runtime = props.useRuntime(snapshot => snapshot)
  const sessions = useSessions(snapshot => snapshot)
  const workspaces = useWorkspaces(snapshot => snapshot)
  const pending = useSessionPendingInteraction(snapshot => snapshot)
  const open = props.useStore(snapshot => snapshot.open)
  const cards = useMemo(
    () => projectCards(sessions, workspaces, pending, runtime, settings.manual),
    [sessions, workspaces, pending, runtime, settings.manual],
  )
  const attention = cards.filter(card => isAttention(card, settings.contextWarningPercent)).length
  return (
    <Tooltip
      label={attention > 0 ? t('sidebar.attention', { count: attention }) : t('sidebar.open')}
      delayMs={500}
      disabled={wide}
    >
      <button
        type="button"
        className="dsk-sidebar-action"
        data-rail={!wide || undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('sidebar.open')}
        onClick={() => { props.actions.open() }}
      >
        <IconChecklistOutline14 size={wide ? 16 : 18} />
        {wide && <span className="dsk-sidebar-label">{t('title')}</span>}
        {attention > 0 && <span className="dsk-sidebar-badge">{attention}</span>}
      </button>
    </Tooltip>
  )
}
