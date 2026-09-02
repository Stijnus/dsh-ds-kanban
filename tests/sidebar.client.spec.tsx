// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SidebarActionProps } from '../src/client/contracts.ts'
import { SidebarAction } from '../src/client/SidebarAction.tsx'
import { DEFAULT_SETTINGS } from '../src/settings.ts'

afterEach(cleanup)

function sidebarProps(wide: boolean, open: boolean, actions: Record<string, ReturnType<typeof vi.fn>>): SidebarActionProps {
  return {
    t: (key: string) => key,
    wide,
    useStore: (select: (snapshot: { open: boolean }) => unknown) => select({ open }),
    useKanbanSettings: (select: (snapshot: { value: unknown }) => unknown) =>
      select({ value: DEFAULT_SETTINGS }),
    useSessions: (select: (snapshot: { phase: string; ids: string[]; byId: Record<string, unknown> }) => unknown) =>
      select({ phase: 'ready', ids: [], byId: {} }),
    useWorkspaces: (select: (snapshot: { items: unknown[] }) => unknown) => select({ items: [] }),
    useSessionPendingInteraction: (select: (snapshot: Set<string>) => unknown) => select(new Set()),
    useRuntime: (select: (snapshot: Record<string, unknown>) => unknown) => select({}),
    actions: { open: vi.fn(), close: vi.fn(), setNewTaskOpen: vi.fn(), setDiagnosticsOpen: vi.fn(), setError: vi.fn(), ...actions },
  } as unknown as SidebarActionProps
}

describe('sidebar action visibility', () => {
  it('renders the expanded row with the shared icon and reports open state', () => {
    const view = render(<SidebarAction {...sidebarProps(true, true, {})} />)
    const button = view.getByRole('button', { name: 'sidebar.open' })
    expect(button.getAttribute('data-rail')).toBe(null)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(button.querySelector('svg')).not.toBe(null)
    expect(button.textContent).toContain('title')
  })

  it('renders the rail circle and opens the board on click', () => {
    const open = vi.fn()
    const view = render(<SidebarAction {...sidebarProps(false, false, { open })} />)
    const button = view.getByRole('button', { name: 'sidebar.open' })
    expect(button.getAttribute('data-rail')).toBe('true')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(open).toHaveBeenCalledTimes(1)
  })
})
