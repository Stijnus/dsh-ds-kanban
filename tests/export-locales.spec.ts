import { describe, expect, it } from 'vitest'
import type { BoardCard } from '../src/client/board.ts'
import { exportCsv, exportJson, exportRows } from '../src/client/export.ts'
import { en, zh } from '../src/client/locales.ts'

const card: BoardCard = {
  id: 'one', title: 'Private, task', workspace: 'Repo', column: 'done', archived: false,
  running: false, waiting: false, updatedAt: Date.UTC(2026, 0, 1), blank: false,
  totalTokens: 12, subagents: 0,
}

describe('privacy-bounded export and locales', () => {
  it('exports only the explicit card allowlist', () => {
    expect(exportRows([card])[0]).toEqual({
      id: 'one', title: 'Private, task', workspace: 'Repo', status: 'done', archived: false,
      updatedAt: '2026-01-01T00:00:00.000Z', totalTokens: 12,
    })
    expect(exportCsv([card])).toContain('"Private, task"')
    const json = JSON.parse(exportJson([card])) as { tasks: unknown[] }
    expect(json.tasks).toHaveLength(1)
    expect(JSON.stringify(json)).not.toContain('prompt')
    expect(JSON.stringify(json)).not.toContain('transcript')
  })

  it('keeps English and Chinese key sets identical', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
    expect(en.title).toBe('DS Kanban')
    expect(zh.title).toBe('DS 看板')
  })
})
