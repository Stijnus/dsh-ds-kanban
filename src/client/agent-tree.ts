/** Aggregate unique descendants from the Harness parent-addressed catalogs. */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export type AgentFilter = 'all' | 'running' | 'waiting'

/** Collect reachable catalogs and retain ancestors of matching descendants for filtered trees. */
export function projectAgentTree(
  root: SessionId,
  catalogs: SessionListState['subagentsByParent'],
  waiting: ReadonlyMap<SessionId, unknown>,
  filter: AgentFilter = 'all',
) {
  const parents = new Set<SessionId>()
  const seen = new Set<SessionId>([root])
  const lineage = new Map<SessionId, SessionId>()
  const matches = new Set<SessionId>()
  const queue = [root]
  let total = 0
  let running = 0
  let awaiting = 0
  let incomplete = false
  let failed = false
  for (let index = 0; index < queue.length; index++) {
    const parent = queue[index]!
    parents.add(parent)
    const catalog = catalogs[parent]
    if (catalog?.state !== 'ready') incomplete = true
    if (catalog?.state === 'error') failed = true
    for (const entry of catalog?.entries ?? []) {
      if (entry.kind === 'diagnostic') { incomplete = true; failed = true; continue }
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      lineage.set(entry.id, parent)
      total++
      if (entry.activity === 'running') running++
      if (waiting.has(entry.id)) awaiting++
      if (filter === 'all' || (filter === 'running' ? entry.activity === 'running' : waiting.has(entry.id))) matches.add(entry.id)
      if (entry.hasChildren) queue.push(entry.id)
    }
  }
  const visible = new Set(matches)
  for (const id of matches) {
    let parent = lineage.get(id)
    while (parent !== undefined && parent !== root && !visible.has(parent)) {
      visible.add(parent)
      parent = lineage.get(parent)
    }
  }
  return { parents, total, running, awaiting, incomplete, failed, visible }
}
