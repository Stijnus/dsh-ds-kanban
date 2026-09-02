import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/index.ts'
import { SETTINGS_NAMESPACE } from '../src/settings.ts'

describe('Host surface', () => {
  it('registers only a validated settings namespace and no mutation route', () => {
    const register = vi.fn((_namespace: unknown, _schema: unknown) => vi.fn())
    const inject = vi.fn((_services, callback: (ctx: unknown) => void) => {
      callback({ settings: { register } })
    })
    apply({ inject } as unknown as Context)
    expect(inject).toHaveBeenCalledWith(['settings'], expect.any(Function))
    expect(register).toHaveBeenCalledTimes(1)
    expect(String(register.mock.calls[0]?.[0])).toContain(SETTINGS_NAMESPACE)
    expect(inject).not.toHaveBeenCalledWith(expect.arrayContaining(['server', 'router']), expect.anything())
  })
})
