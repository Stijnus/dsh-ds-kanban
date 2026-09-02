// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { AgentList } from '../src/client/AgentList.tsx'
import type { KanbanBoardProps } from '../src/client/contracts.ts'
import { en, zh, type KanbanKey } from '../src/client/locales.ts'

afterEach(cleanup)
const parent = 'parent' as SessionId
const child = 'child' as SessionId

function fixture(dictionary: Record<KanbanKey, string> = en) {
  const state: SessionListState = {
    ids: [parent], byId: {}, current: undefined, phase: 'ready', jobsBySession: {}, currentAddress: undefined,
    subagentsByParent: { [parent]: { state: 'ready', error: null, entries: [
      { kind: 'child', id: child, label: 'Research', activity: 'running', hasChildren: false, mode: 'continuable' },
    ] } },
  }
  const props = {
    useSessions: (select: (value: SessionListState) => unknown) => select(state),
    useSessionPendingInteraction: (select: (value: Map<string, unknown>) => unknown) => select(new Map()),
    setSubagentCatalogOpen: vi.fn(), openSubagent: vi.fn(), refreshSubagents: vi.fn(async () => {}),
    actions: { setError: vi.fn() },
    t: (key: KanbanKey, values: Record<string, unknown> = {}) => Object.entries(values).reduce<string>(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), dictionary[key],
    ),
  } as unknown as KanbanBoardProps
  return { state, props }
}

describe('expanded agents', () => {
  it.each([['en', en], ['zh', zh]] as const)('records catalog-only agent presentation in %s', (_locale, dictionary) => {
    const { props } = fixture(dictionary)
    const view = render(<AgentList parentId={parent} props={props} ancestors={[parent]} />)
    expect(view.container.textContent).toMatchSnapshot()
  })

  it('subscribes only while expanded and opens the durable child address', () => {
    const { props } = fixture()
    const view = render(<AgentList parentId={parent} props={props} ancestors={[parent]} />)
    expect(props.setSubagentCatalogOpen).toHaveBeenCalledExactlyOnceWith(parent, true)
    fireEvent.click(screen.getByRole('button', { name: 'Open agent: Research' }))
    expect(props.openSubagent).toHaveBeenCalledWith({ parentSessionId: parent, childSessionId: child, mode: 'continuable' })
    view.unmount()
    expect(props.setSubagentCatalogOpen).toHaveBeenLastCalledWith(parent, false)
  })

  it('updates live activity and labels the next model without inheriting parent model details', () => {
    const { state, props } = fixture()
    const view = render(<AgentList parentId={parent} props={props} ancestors={[parent]} />)
    expect(screen.getByText('Model details unavailable')).toBeDefined()
    state.byId[child] = { id: child, displayTitle: 'Research', running: false, blank: false, updatedAt: 1,
      projectionValues: { modelSelection: { next: { provider: 'deepseek', model: 'reasoner' } } } as never }
    state.subagentsByParent = { [parent]: { state: 'ready', error: null, entries: [
      { kind: 'child', id: child, label: 'Research', activity: 'inactive', hasChildren: false, mode: 'continuable' },
    ] } }
    view.rerender(<AgentList parentId={parent} props={props} ancestors={[parent]} />)
    expect(screen.getByText('Inactive')).toBeDefined()
    expect(screen.getByText('Next model: deepseek/reasoner')).toBeDefined()
    expect(screen.queryByText('Model details unavailable')).toBeNull()
  })

  it('expands descendants only on request and releases both catalogs on unmount', () => {
    const { state, props } = fixture()
    const grandchild = 'grandchild' as SessionId
    state.subagentsByParent = {
      [parent]: { state: 'ready', error: null, entries: [
        { kind: 'child', id: child, label: 'Research', activity: 'running', hasChildren: true, mode: 'continuable' },
      ] },
      [child]: { state: 'ready', error: null, entries: [
        { kind: 'child', id: grandchild, label: 'Verify', activity: 'inactive', hasChildren: false, mode: 'one-shot' },
      ] },
    }
    const view = render(<AgentList parentId={parent} props={props} ancestors={[parent]} />)
    expect(screen.queryByRole('button', { name: 'Open agent: Verify' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show agents' }))
    expect(props.setSubagentCatalogOpen).toHaveBeenCalledWith(child, true)
    fireEvent.click(screen.getByRole('button', { name: 'Open agent: Verify' }))
    expect(props.openSubagent).toHaveBeenCalledWith({ parentSessionId: child, childSessionId: grandchild, mode: 'one-shot' })
    view.unmount()
    expect(props.setSubagentCatalogOpen).toHaveBeenCalledWith(child, false)
    expect(props.setSubagentCatalogOpen).toHaveBeenCalledWith(parent, false)
  })

  it('shows catalog diagnostics and reports a rejected refresh', async () => {
    const { state, props } = fixture()
    state.subagentsByParent = { [parent]: { state: 'ready', error: null, entries: [{ kind: 'diagnostic', id: child, reason: 'unavailable' }] } }
    props.refreshSubagents = vi.fn(async () => { throw new Error('Disconnected') })
    render(<AgentList parentId={parent} props={props} ancestors={[parent]} />)
    expect(screen.getByText('Agent unavailable: unavailable')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Open agent:/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh agents' }))
    await waitFor(() => expect(props.actions.setError).toHaveBeenCalledWith('Disconnected'))
  })
})
