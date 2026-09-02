/** On-demand direct-child catalogs; opening a row uses Harness subagent navigation. */
import { useEffect, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { KanbanBoardProps } from './contracts.ts'

interface AgentListProps {
  readonly parentId: SessionId
  readonly props: KanbanBoardProps
  readonly managed?: boolean
  readonly visibleIds?: ReadonlySet<SessionId> | undefined
  readonly ancestors: readonly string[]
}

/** Observe catalog membership while expanded, without opening child transcripts. */
export function AgentList({ parentId, props, ancestors, managed = false, visibleIds }: AgentListProps) {
  const sessions = props.useSessions(snapshot => snapshot)
  const pending = props.useSessionPendingInteraction(snapshot => snapshot)
  const catalog = sessions.subagentsByParent[parentId]
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const { t, setSubagentCatalogOpen } = props
  useEffect(() => {
    if (managed) return
    setSubagentCatalogOpen(parentId, true)
    return () => { setSubagentCatalogOpen(parentId, false) }
  }, [parentId, setSubagentCatalogOpen, managed])
  const children = catalog?.entries.filter(entry => entry.kind === 'child') ?? []
  return <div className="dsk-agent-list">
    {catalog === undefined || catalog.state === 'loading'
      ? <span role="status">{t('agents.loading')}</span>
      : catalog.state === 'error'
        ? <p role="alert">{catalog.error?.message ?? t('unavailable')}</p>
        : <span>{t('agents.scope', { running: children.filter(child => child.activity === 'running').length, total: children.length })}</span>}
    {catalog?.state === 'ready' && catalog.entries.length === 0 && <span>{t('agents.empty')}</span>}
    {catalog?.entries.map(entry => {
      if (entry.kind === 'diagnostic') return <p key={entry.id}>{t('agents.diagnostic', { reason: entry.reason })}</p>
      if (visibleIds !== undefined && !visibleIds.has(entry.id)) return null
      const summary = sessions.byId[entry.id]
      const model = summary?.projectionValues?.modelSelection?.next
      const preset = summary?.projectionValues?.agentPreset
      const usage = summary?.projectionValues?.tokenUsage
      const steps = summary?.projectionValues?.sessionStats?.steps
      const pressure = summary?.projectionValues?.contextPressure
      const used = pressure?.projectedTokens ?? pressure?.pressureTokens
      const goal = summary?.projectionValues?.goal?.goal
      const title = entry.label ?? summary?.displayTitle ?? entry.id
      const open = visibleIds !== undefined || expanded.has(entry.id)
      return <div className="dsk-agent-row" key={entry.id}>
        <button type="button" aria-label={t('agents.open', { name: title })} onClick={() => {
          props.openSubagent({ parentSessionId: parentId, childSessionId: entry.id, mode: entry.mode })
        }}>{title}</button>
        <strong>{t(pending.has(entry.id) ? 'agents.waiting' : entry.activity === 'running' ? 'agents.running' : 'agents.inactive')}</strong>
        <span>{t(`agents.mode.${entry.mode}`)}</span>
        <span>{model?.model === undefined ? t('agents.noModel') : t('agents.nextModel', { model: [model.provider, model.model].filter(Boolean).join('/') })}</span>
        {usage !== undefined && <span>{t('card.tokens', { count: String(usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens) })}</span>}
        {steps !== undefined && <span>{t('card.steps', { count: steps })}</span>}
        {used !== undefined && pressure?.contextWindow !== undefined && pressure.contextWindow > 0 && <span>{t('card.context', { percent: Math.round(Math.min(100, used / pressure.contextWindow * 100)) })}</span>}
        {typeof preset === 'string' && <span>{t('agents.preset', { preset })}</span>}
        {goal !== undefined && <p>{t('agents.goal', { objective: goal.objective })} · {t(`goal.${goal.phase}`)}</p>}
        {goal?.blockedReason !== undefined && <p className="dsk-failure">{goal.blockedReason.message}</p>}
        {entry.hasChildren && !ancestors.includes(entry.id) && <>
          {visibleIds === undefined && <button type="button" aria-expanded={open} onClick={() => { setExpanded(previous => {
            const next = new Set(previous)
            if (next.has(entry.id)) next.delete(entry.id)
            else next.add(entry.id)
            return next
          }) }}>{t(open ? 'agents.hide' : 'agents.show')}</button>}
          {open && <AgentList parentId={entry.id} props={props} ancestors={[...ancestors, entry.id]} managed={managed} visibleIds={visibleIds} />}
        </>}
      </div>
    })}
    <button type="button" onClick={() => { void props.refreshSubagents(parentId).catch(cause => {
      props.actions.setError(cause instanceof Error ? cause.message : String(cause))
    }) }}>{t('agents.retry')}</button>
  </div>
}
