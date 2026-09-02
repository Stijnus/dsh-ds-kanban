/** Card-level descendant totals remain live while the hierarchy is collapsed. */
import { useEffect, useRef, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { KanbanBoardProps } from './contracts.ts'
import { AgentList } from './AgentList.tsx'
import { projectAgentTree, type AgentFilter } from './agent-tree.ts'

/** Observe reachable catalogs for this visible task, releasing them when the card unmounts. */
export function AgentTree({ parentId, props }: { readonly parentId: SessionId; readonly props: KanbanBoardProps }) {
  const catalogs = props.useSessions(snapshot => snapshot.subagentsByParent)
  const pending = props.useSessionPendingInteraction(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<AgentFilter>('all')
  const tree = projectAgentTree(parentId, catalogs, pending, filter)
  const observed = useRef(new Set<SessionId>())
  const { setSubagentCatalogOpen, t } = props
  useEffect(() => {
    for (const id of observed.current) {
      if (tree.parents.has(id)) continue
      setSubagentCatalogOpen(id, false)
      observed.current.delete(id)
    }
    for (const id of tree.parents) {
      if (observed.current.has(id)) continue
      observed.current.add(id)
      setSubagentCatalogOpen(id, true)
    }
  }, [tree.parents, setSubagentCatalogOpen])
  useEffect(() => () => {
    for (const id of observed.current) setSubagentCatalogOpen(id, false)
    observed.current.clear()
  }, [setSubagentCatalogOpen])
  return <div className="dsk-agents" onClick={event => { event.stopPropagation() }}>
    <strong>{t(tree.incomplete ? 'agents.totalPartial' : 'agents.total', { total: tree.total, running: tree.running })}</strong>
    {tree.incomplete && <span role="status">{t(tree.failed ? 'agents.partialError' : 'agents.loading')}</span>}
    <button type="button" aria-expanded={open} onClick={() => { setOpen(value => !value) }}>{t(open ? 'agents.hide' : 'agents.show')}</button>
    {open && <>
      <div className="dsk-agent-filters">
        {(['all', 'running', 'waiting'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value) }}>{t(`agents.filter.${value}`)}</button>)}
      </div>
      {filter !== 'all' && tree.visible.size === 0 && <span>{t('agents.noMatches')}</span>}
      <AgentList parentId={parentId} props={props} ancestors={[parentId]} managed visibleIds={filter === 'all' ? undefined : tree.visible} />
      <button type="button" onClick={() => { void Promise.all([...tree.parents].map(id => props.refreshSubagents(id))).catch(cause => {
        props.actions.setError(cause instanceof Error ? cause.message : String(cause))
      }) }}>{t('agents.refreshTree')}</button>
    </>}
  </div>
}
