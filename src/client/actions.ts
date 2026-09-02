/** Safe task-creation coordinator over supported Harness Client services. */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { AgentPresetRoster } from '@deepseek-ai/dsh-agent-presets/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

export interface NewTaskInput {
  readonly workspaceId?: WorkspaceId
  readonly preset?: string
  readonly title?: string
  readonly prompt: string
}

/** One healthy preset offered by the new-task form. */
export interface PresetOption {
  readonly id: string
  readonly name?: string
}

/**
 * The agentPresets Remote surface the board reads. The real generated Remote
 * result is structurally assignable; this narrows it to the fields the form uses.
 */
export type AgentPresetsListResult =
  | { readonly ok: true; readonly value: AgentPresetRoster }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/**
 * Read the healthy preset roster for the new-task form.
 * @param remote - the agentPresets Remote method the board uses.
 * @returns selectable presets, treating an unavailable Remote as an empty list.
 */
export async function fetchPresets(remote: { list(): Promise<AgentPresetsListResult> }): Promise<readonly PresetOption[]> {
  const result = await remote.list()
  if (!result.ok) {
    if (result.error.code === 'invocation-unavailable') return []
    throw new Error(result.error.message)
  }
  return result.value.presets.flatMap(preset => preset.broken === undefined
    ? [{ id: preset.id, ...(preset.name === undefined ? {} : { name: preset.name }) }]
    : [])
}

export interface AgentPresetRemote {
  select(sessionId: SessionId, preset: string): Promise<
    | { ok: true; value: string }
    | { ok: false; error: { message: string } }
  >
}

/** A single task-creation operation's dependencies. */
export interface TaskCreationDeps {
  readonly sessions: ISessions
  readonly agentPresets: AgentPresetRemote
}

/**
 * Coalesce duplicate form submissions while one supported create flow is active.
 * A failed post-create title, preset, or prompt step leaves the real blank task visible for recovery.
 */
export class TaskCreator {
  private inFlight: Promise<SessionId> | undefined

  /** @param deps - existing Session service and preset Remote. */
  constructor(private readonly deps: TaskCreationDeps) {}

  /**
   * Create, configure, prompt, and open one real Harness task.
   * @param input - selected Workspace, optional preset/title, and initial prompt.
   * @returns created Session identity.
   */
  create(input: NewTaskInput): Promise<SessionId> {
    if (this.inFlight !== undefined) return this.inFlight
    const operation = this.perform(input)
    this.inFlight = operation
    void operation.finally(() => {
      if (this.inFlight === operation) this.inFlight = undefined
    }).catch(() => {})
    return operation
  }

  private async perform(input: NewTaskInput): Promise<SessionId> {
    const sessionId = await this.deps.sessions.create(
      input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId },
    )
    const session = this.deps.sessions.binding(sessionId)?.session
    if (session === undefined) throw new Error(`created task "${String(sessionId)}" is not locally addressable`)
    const preset = input.preset?.trim()
    if (preset) {
      const selected = await this.deps.agentPresets.select(sessionId, preset)
      if (!selected.ok) throw new Error(selected.error.message)
    }
    const title = input.title?.trim()
    if (title) {
      const renamed = await session.rename(title)
      if (!renamed.ok) throw new Error(renamed.error.message)
    }
    const prompt = input.prompt.trim()
    if (prompt) {
      const admitted = await session.prompt([{ type: 'text', text: prompt }], 'queue')
      if (!admitted.ok) throw new Error(admitted.error.message)
    }
    this.deps.sessions.open(sessionId)
    return sessionId
  }
}
