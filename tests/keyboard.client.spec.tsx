// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BoardCard } from '../src/client/board.ts'
import type { KanbanBoardProps } from '../src/client/contracts.ts'
import { KanbanBoard, TaskCard } from '../src/client/KanbanBoard.tsx'
import { DEFAULT_SETTINGS } from '../src/settings.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const card = (id: string, column: 'inbox' | 'ready'): BoardCard => ({
  id, title: id, column, archived: false, running: false, waiting: false,
  updatedAt: Date.now(), blank: true, subagents: 0,
})

describe('card keyboard navigation', () => {
  it('opens with Enter and moves focus across columns with arrows', () => {
    const openTask = vi.fn()
    const props = {
      t: (key: string) => key,
      openTask,
      copyTaskId: vi.fn(),
      cancelTask: vi.fn(),
      archiveTask: vi.fn(),
      actions: { setError: vi.fn() },
    } as unknown as KanbanBoardProps
    const view = render(<>
      <TaskCard card={card('one', 'inbox')} settings={DEFAULT_SETTINGS} props={props} />
      <TaskCard card={card('two', 'ready')} settings={DEFAULT_SETTINGS} props={props} />
    </>)
    const first = view.container.querySelector<HTMLElement>('[data-card-id="one"]')!
    const second = view.container.querySelector<HTMLElement>('[data-card-id="two"]')!
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(openTask).toHaveBeenCalledWith('one')
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(second)
  })
})

interface ViewSnapshot { open: boolean; newTaskOpen: boolean; diagnosticsOpen: boolean; error: string | undefined }

function boardProps(
  state: Partial<ViewSnapshot>,
  actions: Record<string, ReturnType<typeof vi.fn>>,
  injected: Record<string, unknown> = {},
): KanbanBoardProps {
  return {
    t: (key: string) => key,
    useStore: (select: (snapshot: ViewSnapshot) => unknown) => select({
      open: false, newTaskOpen: false, diagnosticsOpen: false, error: undefined, ...state,
    }),
    useKanbanSettings: (select: (snapshot: { value: unknown; mode: 'host' | 'memory' }) => unknown) =>
      select({ value: DEFAULT_SETTINGS, mode: 'memory' }),
    useSessions: (select: (snapshot: { phase: string; ids: string[]; byId: Record<string, unknown> }) => unknown) =>
      select({ phase: 'ready', ids: [], byId: {} }),
    useWorkspaces: (select: (snapshot: { items: unknown[]; archivedSessionIds: string[] }) => unknown) =>
      select({ items: [], archivedSessionIds: [] }),
    useSessionPendingInteraction: (select: (snapshot: Set<string>) => unknown) => select(new Set()),
    useRuntime: (select: (snapshot: Record<string, unknown>) => unknown) => select({}),
    useConnectionGeneration: (select: (snapshot: number) => unknown) => select(1),
    actions: {
      open: vi.fn(), close: vi.fn(), setNewTaskOpen: vi.fn(), setDiagnosticsOpen: vi.fn(),
      setError: vi.fn(), ...actions,
    },
    openTask: vi.fn(), refresh: vi.fn(async () => {}), archiveTask: vi.fn(async () => {}),
    cancelTask: vi.fn(async () => {}), copyTaskId: vi.fn(async () => {}),
    createTask: vi.fn(async () => 'created'), listPresets: vi.fn(async () => []),
    setSetting: vi.fn(async () => {}), setManual: vi.fn(async () => {}),
    ...injected,
  } as unknown as KanbanBoardProps
}

describe('card context progress bar', () => {
  const cardWithContext = (id: string, contextPercent?: number): BoardCard => ({
    id, title: id, column: 'running', archived: false, running: true, waiting: false,
    updatedAt: Date.now(), blank: false, subagents: 0,
    ...(contextPercent === undefined ? {} : { contextPercent }),
  })
  const props = {
    t: (key: string) => key,
    openTask: vi.fn(),
    copyTaskId: vi.fn(),
    cancelTask: vi.fn(),
    archiveTask: vi.fn(),
    actions: { setError: vi.fn() },
  } as unknown as KanbanBoardProps

  it('renders a color-tone bar from context usage with screen-reader progress values', () => {
    const view = render(<TaskCard card={cardWithContext('low', 40)} settings={DEFAULT_SETTINGS} props={props} />)
    const bar = view.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('40')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(bar.querySelector('span')?.getAttribute('data-tone')).toBe('ok')
  })

  it('escalates the bar tone at and beyond the configured warning threshold', () => {
    const warn = render(<TaskCard card={cardWithContext('warn', DEFAULT_SETTINGS.contextWarningPercent)} settings={DEFAULT_SETTINGS} props={props} />)
    expect(within(warn.container).getByRole('progressbar').querySelector('span')?.getAttribute('data-tone')).toBe('warn')
    const critical = render(<TaskCard card={cardWithContext('full', 100)} settings={DEFAULT_SETTINGS} props={props} />)
    expect(within(critical.container).getByRole('progressbar').querySelector('span')?.getAttribute('data-tone')).toBe('critical')
  })

  it('omits the bar when the card has no context projection', () => {
    const view = render(<TaskCard card={cardWithContext('none')} settings={DEFAULT_SETTINGS} props={props} />)
    expect(view.queryByRole('progressbar')).toBeNull()
  })
})

describe('board close paths', () => {
  it('focuses the back control on open and closes via document Escape back to the sidebar action', () => {
    const close = vi.fn()
    const opener = document.createElement('button')
    opener.className = 'dsk-sidebar-action'
    document.body.appendChild(opener)
    const view = render(<KanbanBoard {...boardProps({ open: true }, { close })} />)
    const back = view.getByRole('button', { name: 'back' })
    // The board portals to the document top layer, not the slot render site.
    expect(view.container.contains(back)).toBe(false)
    expect(document.body.contains(back)).toBe(true)
    expect(document.activeElement).toBe(back)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(close).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('closes the new-task dialog with Escape before the board itself', () => {
    const close = vi.fn()
    const setNewTaskOpen = vi.fn()
    render(<KanbanBoard {...boardProps({ open: true, newTaskOpen: true }, { close, setNewTaskOpen })} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(setNewTaskOpen).toHaveBeenCalledWith(false)
    expect(close).not.toHaveBeenCalled()
  })

  it('returns focus to the sidebar action from the back control', () => {
    const opener = document.createElement('button')
    opener.className = 'dsk-sidebar-action'
    document.body.appendChild(opener)
    const view = render(<KanbanBoard {...boardProps({ open: true }, {})} />)
    fireEvent.click(view.getByRole('button', { name: 'back' }))
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

describe('modal focus and submission', () => {
  it('moves focus into the new-task dialog when it opens over the board and traps Tab inside it', () => {
    const view = render(<KanbanBoard {...boardProps({ open: true }, {})} />)
    view.rerender(<KanbanBoard {...boardProps({ open: true, newTaskOpen: true }, {})} />)
    const dialog = screen.getByRole('dialog')
    expect(document.activeElement).toBe(dialog)
    const focusable = [...dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )].filter(element => !element.hasAttribute('disabled'))
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('creates a task from the dialog and closes the board', async () => {
    const close = vi.fn()
    const setNewTaskOpen = vi.fn()
    const createTask = vi.fn(async () => 'created')
    render(<KanbanBoard {...boardProps({ open: true, newTaskOpen: true }, { close, setNewTaskOpen }, { createTask })} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('new.prompt'), { target: { value: 'Do the work' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'new.create' }))
    await waitFor(() => expect(createTask).toHaveBeenCalledWith({ prompt: 'Do the work' }))
    expect(setNewTaskOpen).toHaveBeenCalledWith(false)
    expect(close).toHaveBeenCalled()
  })

  it('surfaces a failed creation inside the dialog', async () => {
    const createTask = vi.fn(async () => { throw new Error('boom') })
    render(<KanbanBoard {...boardProps({ open: true, newTaskOpen: true }, {}, { createTask })} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('new.prompt'), { target: { value: 'Do it' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'new.create' }))
    expect((await screen.findByRole('alert')).textContent).toContain('new.error')
  })

  it('surfaces a failed card archive in the board error banner', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const archiveTask = vi.fn(async () => { throw new Error('archive failed') })
    const setError = vi.fn()
    const props = {
      t: (key: string) => key,
      openTask: vi.fn(),
      copyTaskId: vi.fn(),
      cancelTask: vi.fn(),
      archiveTask,
      actions: { setError },
    } as unknown as KanbanBoardProps
    render(<TaskCard card={card('one', 'ready')} settings={DEFAULT_SETTINGS} props={props} />)
    fireEvent.click(screen.getByRole('button', { name: 'card.archive' }))
    await waitFor(() => expect(setError).toHaveBeenCalledWith('archive failed'))
  })
})


describe('board controls', () => {
  it('keeps informational totals out of the button tab order', () => {
    render(<KanbanBoard {...boardProps({ open: true }, {})} />)
    for (const name of ['stats.tokens', 'stats.cost', 'stats.context', 'stats.workspaces']) {
      expect(screen.queryByRole('button', { name: new RegExp(name) })).toBeNull()
      expect(screen.getByText(name)).toBeDefined()
    }
    expect(screen.getByRole('button', { name: /stats.visible/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('reports failed refreshes and filter writes', async () => {
    const setError = vi.fn()
    const props = boardProps({ open: true }, { setError }, {
      refresh: vi.fn(async () => { throw new Error('refresh disconnected') }),
      setSetting: vi.fn(async () => { throw new Error('settings disconnected') }),
    })
    render(<KanbanBoard {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    await waitFor(() => expect(setError).toHaveBeenCalledWith('refresh disconnected'))
    fireEvent.click(screen.getByRole('button', { name: /stats.waiting/ }))
    await waitFor(() => expect(setError).toHaveBeenCalledWith('settings disconnected'))
  })

  it('keeps reverse Tab inside Diagnostics from its initial focus', () => {
    const view = render(<KanbanBoard {...boardProps({ open: true }, {})} />)
    view.rerender(<KanbanBoard {...boardProps({ open: true, diagnosticsOpen: true }, {})} />)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'diagnostics.close' }))
  })
})
