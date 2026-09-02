/** Explicit privacy-bounded exports of the current board projection. */
import type { BoardCard } from './board.ts'

/** Serializable board row; no prompt, transcript, or tool-result fields exist. */
export interface ExportRow {
  readonly id: string
  readonly title: string
  readonly workspace?: string
  readonly status: string
  readonly archived: boolean
  readonly updatedAt: string
  readonly preset?: string
  readonly provider?: string
  readonly model?: string
  readonly steps?: number
  readonly totalTokens?: number
  readonly contextPercent?: number
}

/** Convert visible cards to the explicit export allowlist. */
export function exportRows(cards: readonly BoardCard[]): ExportRow[] {
  return cards.map(card => ({
    id: card.id,
    title: card.title,
    ...(card.workspace === undefined ? {} : { workspace: card.workspace }),
    status: card.column,
    archived: card.archived,
    updatedAt: new Date(card.updatedAt).toISOString(),
    ...(card.preset === undefined ? {} : { preset: card.preset }),
    ...(card.provider === undefined ? {} : { provider: card.provider }),
    ...(card.model === undefined ? {} : { model: card.model }),
    ...(card.steps === undefined ? {} : { steps: card.steps }),
    ...(card.totalTokens === undefined ? {} : { totalTokens: card.totalTokens }),
    ...(card.contextPercent === undefined ? {} : { contextPercent: card.contextPercent }),
  }))
}

function csvCell(value: unknown): string {
  const text = value === undefined ? '' : String(value)
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Encode the export allowlist as RFC 4180-style CSV. */
export function exportCsv(cards: readonly BoardCard[]): string {
  const keys: (keyof ExportRow)[] = [
    'id', 'title', 'workspace', 'status', 'archived', 'updatedAt', 'preset', 'provider',
    'model', 'steps', 'totalTokens', 'contextPercent',
  ]
  const lines = [keys.join(',')]
  for (const row of exportRows(cards)) lines.push(keys.map(key => csvCell(row[key])).join(','))
  return `${lines.join('\r\n')}\r\n`
}

/** Encode the export allowlist as versioned JSON. */
export function exportJson(cards: readonly BoardCard[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks: exportRows(cards) }, null, 2)
}
