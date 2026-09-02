/** Full-size live operations board rendered inside the existing Harness shell. */
import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
  type DragEvent, type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  IconArchiveOutline20, IconChevronLeftOutline14, IconCopyOutline16, IconPlusOutline16,
  IconRefreshOutline16, IconStopFill16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { BOARD_COLUMNS, aggregateStats, attentionReason, contextTone, createCardProjector, dropColumn, filterCards, filtersFromSettings, groupCards, type BoardCard, type BoardColumn } from './board.ts'
import type { KanbanBoardProps, PresetOption } from './contracts.ts'
import { workspaceId } from './contracts.ts'
import { DENSITIES, DEFAULT_SETTINGS, SORT_ORDERS, TIME_MODES, type Density, type KanbanSettings, type SortOrder, type TimeMode } from '../settings.ts'
import { exportCsv, exportJson } from './export.ts'
import { useModalFocus } from './focus.ts'

/** Initial per-column DOM budget; operators can reveal further cards in bounded pages. */
export const COLUMN_CARD_PAGE_SIZE = 60

/** Return the bounded card page rendered by one column. */
export function visibleColumnCards(cards: readonly BoardCard[], limit: number): readonly BoardCard[] {
  return cards.slice(0, Math.max(0, limit))
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function relativeTime(time: number, t: KanbanBoardProps['t']): string {
  const delta = Math.max(0, Date.now() - time)
  const minutes = Math.floor(delta / 60_000)
  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('time.hoursAgo', { count: hours })
  return t('time.daysAgo', { count: Math.floor(hours / 24) })
}

function saveFile(name: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function statusKey(column: BoardColumn): `status.${BoardColumn}` {
  return `status.${column}`
}

interface CardProps {
  readonly card: BoardCard
  readonly settings: KanbanSettings
  readonly props: KanbanBoardProps
}

/** Render one session's execution state, durable goal, and navigation actions. */
export const TaskCard = memo(function TaskCard({ card, settings, props }: CardProps) {
  const { t } = props
  const attention = attentionReason(card, settings.contextWarningPercent)
  const reportFailure = (cause: unknown): void => {
    props.actions.setError(cause instanceof Error ? cause.message : String(cause))
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter') props.openTask(card.id as SessionId)
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const index = BOARD_COLUMNS.indexOf(card.column)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    for (let target = index + direction; target >= 0 && target < BOARD_COLUMNS.length; target += direction) {
      const next = document.querySelector<HTMLElement>(`[data-card-column="${BOARD_COLUMNS[target]}"]`)
      if (next === null) continue
      next.focus()
      break
    }
  }
  const moveable = card.blank && (card.column === 'inbox' || card.column === 'ready')
  return (
    <article
      className="dsk-card"
      data-card-column={card.column}
      data-card-id={card.id}
      draggable={moveable}
      tabIndex={0}
      onClick={() => { props.openTask(card.id as SessionId) }}
      onKeyDown={onKeyDown}
      onDragStart={(event) => { event.dataTransfer.setData('text/ds-kanban-session', card.id) }}
    >
      <div className="dsk-card-head">
        <strong>{card.title}</strong>
        <span className={`dsk-status dsk-status-${card.column}`}>{t(statusKey(card.column))}</span>
      </div>
      <div className="dsk-card-sub">
        {card.workspace ?? card.cwd ?? card.id}
      </div>
      <div className="dsk-card-badges">
        {card.archived && <span>{t('archived')}</span>}
        {card.queueLength !== undefined && card.queueLength > 0 && <span>{t('card.queued', { count: card.queueLength })}</span>}
        {card.preset !== undefined && <span>{card.preset}</span>}
        {card.provider !== undefined && card.model !== undefined && <span>{card.provider}/{card.model}</span>}
        {card.steps !== undefined && <span>{t('card.steps', { count: card.steps })}</span>}
        {card.totalTokens !== undefined && <span>{t('card.tokens', { count: compactNumber(card.totalTokens) })}</span>}
        {card.contextPercent !== undefined && (
          <span data-warning={card.contextPercent >= settings.contextWarningPercent || undefined}>
            {t('card.context', { percent: Math.round(card.contextPercent) })}
          </span>
        )}
        {card.subagents > 0 && <span>{t('card.subagents', { count: card.subagents })}</span>}
      </div>
      {card.goal !== undefined && <div className="dsk-goal">
        <strong>{t(`goal.${card.goal.goal.phase}`)}</strong>
        <p>{card.goal.goal.objective}</p>
        <span>{t('goal.rounds', { used: card.goal.roundsStarted, limit: card.goal.goal.maxGoalRounds })}</span>
        {card.goal.goal.phase === 'active' && !card.running && <span>{t('goal.activeHint')}</span>}
        {card.goal.goal.blockedReason !== undefined && <p className="dsk-failure">{card.goal.goal.blockedReason.message}</p>}
      </div>}
      {card.contextPercent !== undefined && (
        <div
          className="dsk-context-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(card.contextPercent)}
          aria-label={t('card.contextBar')}
        >
          <span style={{ width: `${card.contextPercent}%` }} data-tone={contextTone(card.contextPercent, settings.contextWarningPercent)} />
        </div>
      )}
      {card.failure !== undefined && <p className="dsk-failure">{card.failure}</p>}
      {attention !== undefined && <button className="dsk-attention" type="button" onClick={event => {
        event.stopPropagation()
        props.openTask(card.id as SessionId)
      }}>{t(`attention.${attention}`)}</button>}
      <div className="dsk-card-foot">
        <span>{t('card.lastActivity', {
          time: settings.timeMode === 'absolute'
            ? new Date(card.updatedAt).toLocaleString()
            : relativeTime(card.updatedAt, t),
        })}</span>
        <div className="dsk-card-actions">
          <button type="button" aria-label={t('card.copyId')} title={t('card.copyId')} onClick={(event) => {
            event.stopPropagation()
            void props.copyTaskId(card.id as SessionId).catch(reportFailure)
          }}><IconCopyOutline16 size={14} /></button>
          {card.running && <button type="button" aria-label={t('card.cancel')} title={t('card.cancel')} onClick={(event) => {
            event.stopPropagation()
            if (!window.confirm(t('card.confirmCancel', { title: card.title }))) return
            void props.cancelTask(card.id as SessionId).catch(reportFailure)
          }}><IconStopFill16 size={14} /></button>}
          {!card.archived && <button type="button" aria-label={t('card.archive')} title={t('card.archive')} onClick={(event) => {
            event.stopPropagation()
            if (!window.confirm(t('card.confirmArchive', { title: card.title }))) return
            void props.archiveTask(card.id as SessionId).catch(reportFailure)
          }}><IconArchiveOutline20 size={14} /></button>}
        </div>
      </div>
    </article>
  )
})

interface ColumnProps {
  readonly column: BoardColumn
  readonly cards: readonly BoardCard[]
  readonly settings: KanbanSettings
  readonly props: KanbanBoardProps
}

function BoardColumnView({ column, cards, settings, props }: ColumnProps) {
  const [limit, setLimit] = useState(COLUMN_CARD_PAGE_SIZE)
  const visibleCards = visibleColumnCards(cards, limit)
  return (
    <section
      className="dsk-column"
      data-column={column}
      onDragOver={(event: DragEvent) => {
        if (column !== 'inbox' && column !== 'ready') return
        event.preventDefault()
      }}
      onDrop={(event: DragEvent) => {
        if (column !== 'inbox' && column !== 'ready') return
        event.preventDefault()
        const id = event.dataTransfer.getData('text/ds-kanban-session')
        const target = dropColumn(id, column, cards)
        if (target === undefined) return
        void props.setManual(id as SessionId, target)
      }}
    >
      <header><h2>{props.t(`column.${column}`)}</h2><span>{cards.length}</span></header>
      <div className="dsk-card-list">
        {visibleCards.map(card => <TaskCard key={card.id} card={card} settings={settings} props={props} />)}
        {visibleCards.length < cards.length && <button className="dsk-show-more" type="button" onClick={() => {
          setLimit(current => current + COLUMN_CARD_PAGE_SIZE)
        }}>{props.t('column.showMore', { visible: visibleCards.length, total: cards.length })}</button>}
      </div>
    </section>
  )
}

function Columns({ cards, settings, props }: {
  readonly cards: readonly BoardCard[]
  readonly settings: KanbanSettings
  readonly props: KanbanBoardProps
}) {
  return <div className="dsk-columns">{BOARD_COLUMNS.map(column => (
    <BoardColumnView
      key={column}
      column={column}
      cards={cards.filter(card => card.column === column)}
      settings={settings}
      props={props}
    />
  ))}</div>
}

function NewTaskModal({ props, workspaces }: {
  readonly props: KanbanBoardProps
  readonly workspaces: WorkspaceSnapshot
}) {
  const { t } = props
  const dialogRef = useModalFocus<HTMLElement>()
  const [workspace, setWorkspace] = useState('')
  const [preset, setPreset] = useState('')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [presets, setPresets] = useState<readonly PresetOption[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    let active = true
    void props.listPresets().then(rows => { if (active) setPresets(rows) }).catch(() => {})
    return () => { active = false }
  }, [props.listPresets])
  const submit = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      const selectedWorkspace = workspaceId(workspace)
      await props.createTask({
        ...(selectedWorkspace === undefined ? {} : { workspaceId: selectedWorkspace }),
        ...(preset === '' ? {} : { preset }),
        ...(title.trim() === '' ? {} : { title }),
        prompt,
      })
      props.actions.setNewTaskOpen(false)
      props.actions.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }
  return <div className="dsk-modal-backdrop" role="presentation">
    <section className="dsk-modal" role="dialog" aria-modal="true" aria-labelledby="dsk-new-title" ref={dialogRef} tabIndex={-1}>
      <h2 id="dsk-new-title">{t('new.title')}</h2>
      <label>{t('new.workspace')}<select value={workspace} onChange={event => { setWorkspace(event.target.value) }}>
        <option value="">{t('new.noWorkspace')}</option>
        {workspaces.items.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title}</option>)}
      </select></label>
      <label>{t('new.preset')}<select value={preset} onChange={event => { setPreset(event.target.value) }}>
        <option value="">{t('new.defaultPreset')}</option>
        {presets.map(item => <option key={item.id} value={item.id}>{item.name ?? item.id}</option>)}
      </select></label>
      <label>{t('new.taskTitle')}<input value={title} placeholder={t('new.taskTitlePlaceholder')} onChange={event => { setTitle(event.target.value) }} /></label>
      <label>{t('new.prompt')}<textarea value={prompt} placeholder={t('new.promptPlaceholder')} onChange={event => { setPrompt(event.target.value) }} /></label>
      {error !== undefined && <p className="dsk-error" role="alert">{t('new.error', { message: error })}</p>}
      <footer>
        <button type="button" onClick={() => { props.actions.setNewTaskOpen(false) }}>{t('new.cancel')}</button>
        <button type="button" disabled={busy || prompt.trim() === ''} onClick={() => { void submit() }}>{busy ? t('new.creating') : t('new.create')}</button>
      </footer>
    </section>
  </div>
}

function Diagnostics({ props, settingsMode }: { readonly props: KanbanBoardProps; readonly settingsMode: 'host' | 'memory' }) {
  const { t } = props
  const dialogRef = useModalFocus<HTMLElement>()
  return <div className="dsk-modal-backdrop" role="presentation">
    <section className="dsk-modal dsk-diagnostics" role="dialog" aria-modal="true" aria-labelledby="dsk-diagnostics-title" ref={dialogRef} tabIndex={-1}>
      <h2 id="dsk-diagnostics-title">{t('diagnostics.title')}</h2>
      <h3>{t('diagnostics.available')}</h3><p>{t('diagnostics.availableList')}</p>
      <h3>{t('diagnostics.unavailable')}</h3><p>{t('diagnostics.unavailableList')}</p>
      <p>{t('diagnostics.persistence', { mode: t(settingsMode === 'host' ? 'diagnostics.hostPersistence' : 'diagnostics.memoryPersistence') })}</p>
      <p>{t('diagnostics.privacy')}</p>
      <footer><button type="button" onClick={() => { props.actions.setDiagnosticsOpen(false) }}>{t('diagnostics.close')}</button></footer>
    </section>
  </div>
}

export function KanbanBoard(props: KanbanBoardProps) {
  const open = props.useStore(state => state.open)
  const newTaskOpen = props.useStore(state => state.newTaskOpen)
  const diagnosticsOpen = props.useStore(state => state.diagnosticsOpen)
  const error = props.useStore(state => state.error)
  const settingsSnapshot = props.useKanbanSettings(snapshot => snapshot)
  const settings = settingsSnapshot.value ?? DEFAULT_SETTINGS
  const sessions = props.useSessions(snapshot => snapshot)
  const workspaces = props.useWorkspaces(snapshot => snapshot)
  const pending = props.useSessionPendingInteraction(snapshot => snapshot)
  const runtime = props.useRuntime(snapshot => snapshot)
  const connection = props.useConnectionGeneration(snapshot => snapshot)
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const projectCards = useMemo(createCardProjector, [])
  const allCards = useMemo(
    () => projectCards(sessions, workspaces, pending, runtime, settings.manual),
    [projectCards, sessions, workspaces, pending, runtime, settings.manual],
  )
  const cards = useMemo(
    () => filterCards(allCards, filtersFromSettings(settings, search)),
    [allCards, settings, search],
  )
  const stats = useMemo(() => aggregateStats(cards), [cards])
  const presetModels = useMemo(() => [...new Set(allCards.flatMap(card =>
    [card.preset, card.provider, card.model].filter((value): value is string => value !== undefined),
  ))].sort(), [allCards])
  const backRef = useRef<HTMLButtonElement>(null)

  // The overlay covers its opener, so opening must move focus into the board
  // (the back control); otherwise focus stays on the hidden sidebar button and
  // keyboard input reaches nothing visible.
  useEffect(() => { if (open) backRef.current?.focus() }, [open])

  // Closing through the back control or Escape hands focus back to the opener.
  const returnToSidebar = useCallback((): void => {
    document.querySelector<HTMLButtonElement>('.dsk-sidebar-action')?.focus()
  }, [])
  const closeAndReturn = useCallback((): void => {
    returnToSidebar()
    props.actions.close()
  }, [props.actions, returnToSidebar])

  // Escape must work while focus is anywhere: the Settings panel precedent
  // mounts a document-level listener for the overlay's lifetime, not a handler
  // on the board element that only fires for focus already inside it.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (newTaskOpen) props.actions.setNewTaskOpen(false)
      else if (diagnosticsOpen) props.actions.setDiagnosticsOpen(false)
      else closeAndReturn()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open, newTaskOpen, diagnosticsOpen, props.actions, closeAndReturn])

  if (!open) return null

  const set = <K extends keyof KanbanSettings>(field: K, value: KanbanSettings[K]): void => {
    void props.setSetting(field, value)
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault()
      searchRef.current?.focus()
    }
  }
  const statButton = (label: string, value: string | number, status?: string) => (
    <button type="button" disabled={status === undefined} onClick={() => { if (status !== undefined) set('status', status) }}>
      <strong>{value}</strong><span>{label}</span>
    </button>
  )
  const renderBoard = (scopeCards: readonly BoardCard[]) => <Columns cards={scopeCards} settings={settings} props={props} />
  // The shell's overlay layer sits below the floating panel toggles and the
  // details/bottom panels, so a full-shell board rendered there collects the
  // shell's icons over its toolbar. The Settings panel precedent renders
  // full-viewport surfaces at the top stacking level; the portal does the same
  // for the board without touching the shell.
  return createPortal(
    <div className="dsk-root" data-density={settings.density} onKeyDown={onKeyDown}>
      <header className="dsk-topbar">
        <div className="dsk-topbar-lead">
          <button ref={backRef} type="button" className="dsk-back" onClick={closeAndReturn}>
            <IconChevronLeftOutline14 size={14} />
            <span>{props.t('back')}</span>
          </button>
          <div className="dsk-topbar-title">
            <h1>{props.t('title')}</h1>
            {connection === undefined && <span className="dsk-disconnected">{props.t('disconnected')}</span>}
          </div>
        </div>
        <nav>
          <button type="button" onClick={() => { props.actions.setNewTaskOpen(true) }}>
            <IconPlusOutline16 size={14} /><span>{props.t('newTask')}</span>
          </button>
          <button type="button" onClick={() => { props.actions.setDiagnosticsOpen(true) }}>{props.t('diagnostics')}</button>
          <button type="button" onClick={() => { void props.refresh() }}>
            <IconRefreshOutline16 size={14} /><span>{props.t('refresh')}</span>
          </button>
          <button type="button" onClick={() => { saveFile('ds-kanban.json', 'application/json', exportJson(cards)) }}>{props.t('exportJson')}</button>
          <button type="button" onClick={() => { saveFile('ds-kanban.csv', 'text/csv', exportCsv(cards)) }}>{props.t('exportCsv')}</button>
        </nav>
      </header>
      {error !== undefined && (
        <div className="dsk-error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => { props.actions.setError(undefined) }}>{props.t('error.dismiss')}</button>
        </div>
      )}
      <section className="dsk-stats" aria-label={props.t('title')}>
        {statButton(props.t('stats.visible'), stats.visible, '')}
        {statButton(props.t('stats.running'), stats.running, 'running')}
        {statButton(props.t('stats.waiting'), stats.waiting, 'waiting')}
        {statButton(props.t('stats.blocked'), stats.blocked, 'blocked')}
        {statButton(props.t('stats.completed'), stats.completed, 'done')}
        {statButton(props.t('stats.tokens'), compactNumber(stats.tokens), '')}
        {statButton(props.t('stats.cost'), props.t('unavailable'))}
        {statButton(props.t('stats.context'), stats.averageContext === undefined ? props.t('unavailable') : `${Math.round(stats.averageContext)}%`, '')}
        {statButton(props.t('stats.workspaces'), stats.workspaces, '')}
      </section>
      <section className="dsk-filters">
        <label className="dsk-search"><span>{props.t('filters.search')}</span><input ref={searchRef} type="search" value={search} placeholder={props.t('filters.searchPlaceholder')} onChange={event => { setSearch(event.target.value) }} /></label>
        <label><span>{props.t('filters.workspace')}</span><select value={settings.workspace} onChange={event => { set('workspace', event.target.value) }}><option value="">{props.t('filters.allWorkspaces')}</option>{workspaces.items.map(item => <option key={item.workspaceId} value={item.workspaceId}>{item.title}</option>)}</select></label>
        <label><span>{props.t('filters.status')}</span><select value={settings.status} onChange={event => { set('status', event.target.value) }}><option value="">{props.t('filters.allStatuses')}</option><option value="attention">{props.t('filters.attention')}</option>{BOARD_COLUMNS.map(column => <option key={column} value={column}>{props.t(`column.${column}`)}</option>)}</select></label>
        <label><span>{props.t('filters.presetModel')}</span><select value={settings.presetModel} onChange={event => { set('presetModel', event.target.value) }}><option value="">{props.t('filters.allPresetModels')}</option>{presetModels.map(value => <option key={value}>{value}</option>)}</select></label>
        <label><span>{props.t('filters.sort')}</span><select value={settings.sort} onChange={event => { set('sort', event.target.value as SortOrder) }}>{SORT_ORDERS.map(value => <option key={value} value={value} disabled={value === 'runtime' || value === 'cost'}>{props.t(`sort.${value}`)}</option>)}</select></label>
        <label><span>{props.t('filters.density')}</span><select value={settings.density} onChange={event => { set('density', event.target.value as Density) }}>{DENSITIES.map(value => <option key={value} value={value}>{props.t(`density.${value}`)}</option>)}</select></label>
        <label><span>{props.t('filters.time')}</span><select value={settings.timeMode} onChange={event => { set('timeMode', event.target.value as TimeMode) }}>{TIME_MODES.map(value => <option key={value} value={value}>{props.t(`time.${value}`)}</option>)}</select></label>
        <label className="dsk-check"><input type="checkbox" checked={settings.activeOnly} onChange={event => { set('activeOnly', event.target.checked) }} />{props.t('filters.activeOnly')}</label>
        <label className="dsk-check"><input type="checkbox" checked={settings.includeArchived} onChange={event => { set('includeArchived', event.target.checked) }} />{props.t('filters.includeArchived')}</label>
        <label className="dsk-check"><input type="checkbox" checked={settings.groupByWorkspace} onChange={event => { set('groupByWorkspace', event.target.checked) }} />{props.t('filters.groupWorkspace')}</label>
      </section>
      <main className="dsk-board-scroll">
        {sessions.phase === 'pending' ? <div className="dsk-state">{props.t('loading')}</div>
          : cards.length === 0 ? <div className="dsk-state">{props.t('empty')}</div>
            : settings.groupByWorkspace
              ? [...groupCards(cards)].map(([workspace, scoped]) => <section className="dsk-workspace-group" key={workspace}><h2>{workspace || props.t('workspace.ungrouped')}</h2>{renderBoard(scoped)}</section>)
              : renderBoard(cards)}
      </main>
      {newTaskOpen && <NewTaskModal props={props} workspaces={workspaces} />}
      {diagnosticsOpen && <Diagnostics props={props} settingsMode={settingsSnapshot.mode} />}
    </div>,
    document.body,
  )
}
