import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SETTINGS_VERSION, decodeSettings } from '../src/settings.ts'

describe('settings decoder', () => {
  it('accepts the exact versioned record', () => {
    expect(decodeSettings({ ...DEFAULT_SETTINGS, manual: { task: 'ready' } })).toEqual({
      ...DEFAULT_SETTINGS, manual: { task: 'ready' },
    })
  })

  it.each([
    null,
    { ...DEFAULT_SETTINGS, version: SETTINGS_VERSION + 1 },
    { ...DEFAULT_SETTINGS, manual: { task: 'running' } },
    { ...DEFAULT_SETTINGS, contextWarningPercent: 0 },
    { ...DEFAULT_SETTINGS, includeArchived: 'yes' },
  ])('refuses malformed or unknown-version state without repairing it', value => {
    expect(decodeSettings(value)).toBeUndefined()
  })
})
