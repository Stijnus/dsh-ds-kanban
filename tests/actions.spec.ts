import { describe, expect, it, vi } from 'vitest'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { TaskCreator, fetchPresets } from '../src/client/actions.ts'

const sid = 'created' as SessionId

describe('task creation', () => {
  it('coalesces duplicate submissions and uses the existing Session flow once', async () => {
    let release: ((value: SessionId) => void) | undefined
    const create = vi.fn(() => new Promise<SessionId>(resolve => { release = resolve }))
    const rename = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const prompt = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const open = vi.fn()
    const sessions = {
      create,
      open,
      binding: () => ({ session: { rename, prompt } }),
    } as unknown as ISessions
    const select = vi.fn(async () => ({ ok: true as const, value: 'preset' }))
    const creator = new TaskCreator({ sessions, agentPresets: { select } })
    const input = { prompt: 'Do the work', title: 'Work', preset: 'headless' }
    const first = creator.create(input)
    const duplicate = creator.create(input)
    expect(first).toBe(duplicate)
    release?.(sid)
    await expect(first).resolves.toBe(sid)
    expect(create).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledWith(sid, 'headless')
    expect(rename).toHaveBeenCalledWith('Work')
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(sid)
  })
})

describe('task creation failures', () => {
  it('rejects when the created session is not locally addressable', async () => {
    const sessions = {
      create: vi.fn(async () => sid),
      binding: () => undefined,
    } as unknown as ISessions
    const creator = new TaskCreator({ sessions, agentPresets: { select: vi.fn() } })
    await expect(creator.create({ prompt: 'Do it' })).rejects.toThrow('not locally addressable')
  })

  it('rejects a failed preset, rename, or prompt step and never opens the session', async () => {
    const open = vi.fn()
    const make = (rename: ReturnType<typeof vi.fn>, prompt: ReturnType<typeof vi.fn>) => ({
      create: vi.fn(async () => sid),
      open,
      binding: () => ({ session: { rename, prompt } }),
    }) as unknown as ISessions
    const okRename = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const okPrompt = vi.fn(async () => ({ ok: true as const, value: undefined }))
    const okSelect = vi.fn(async () => ({ ok: true as const, value: '' }))

    const presetFail = new TaskCreator({
      sessions: make(okRename, okPrompt),
      agentPresets: { select: vi.fn(async () => ({ ok: false as const, error: { message: 'preset broken' } })) },
    })
    await expect(presetFail.create({ prompt: 'x', preset: 'headless' })).rejects.toThrow('preset broken')

    const renameFail = new TaskCreator({
      sessions: make(vi.fn(async () => ({ ok: false as const, error: { message: 'rename denied' } })), okPrompt),
      agentPresets: { select: okSelect },
    })
    await expect(renameFail.create({ prompt: 'x', title: 'T' })).rejects.toThrow('rename denied')

    const promptFail = new TaskCreator({
      sessions: make(okRename, vi.fn(async () => ({ ok: false as const, error: { message: 'prompt rejected' } }))),
      agentPresets: { select: okSelect },
    })
    await expect(promptFail.create({ prompt: 'x' })).rejects.toThrow('prompt rejected')

    expect(open).not.toHaveBeenCalled()
  })
})

describe('preset fetching', () => {
  it('returns healthy presets and treats an unavailable Remote as empty', async () => {
    const healthy = fetchPresets({ list: async () => ({ ok: true as const, value: {
      presets: [
        { id: 'headless', name: 'Headless', trust: 'root' as never, isDefault: false },
        { id: 'broken', broken: 'missing root', trust: 'root' as never, isDefault: false },
        { id: 'bare', trust: 'root' as never, isDefault: false },
      ],
      authorable: false,
    } }) })
    await expect(healthy).resolves.toEqual([
      { id: 'headless', name: 'Headless' }, { id: 'bare' },
    ])

    const unavailable = fetchPresets({
      list: async () => ({ ok: false as const, error: { code: 'invocation-unavailable', message: 'offline' } }),
    })
    await expect(unavailable).resolves.toEqual([])
  })

  it('throws the Remote message for other failures', async () => {
    await expect(fetchPresets({
      list: async () => ({ ok: false as const, error: { code: 'agent-preset-invalid', message: 'nope' } }),
    })).rejects.toThrow('nope')
  })
})
