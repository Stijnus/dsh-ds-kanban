import { describe, expect, it } from 'vitest'
import { styles } from '../src/client/styles.ts'

const COLUMNS = ['inbox', 'ready', 'running', 'waiting', 'blocked', 'done'] as const

describe('responsive and accessible styles', () => {
  it('defines narrow layouts, visible focus, tokens, and reduced motion', () => {
    expect(styles).toMatch(/@media\s*\(max-width:/u)
    expect(styles).toMatch(/focus-visible/u)
    expect(styles).toMatch(/prefers-reduced-motion/u)
    expect(styles).toMatch(/var\(--/u)
  })
})

describe('status and progress colors', () => {
  it('gives every card column a status border color from theme tokens', () => {
    for (const column of COLUMNS) {
      expect(styles).toMatch(new RegExp(`\\.dsk-card\\[data-card-column=${column}\\]\\{--dsh-card-status:var\\(--dsw-alias-[a-z-]+\\)\\}`, 'u'))
    }
  })

  it('colors every status badge through theme tokens', () => {
    for (const column of COLUMNS) {
      expect(styles).toMatch(new RegExp(`\\.dsk-status-${column}\\{color:var\\(--dsw-alias-[a-z-]+\\)\\}`, 'u'))
    }
  })

  it('colors the context progress bar tones through theme tokens', () => {
    expect(styles).toContain('.dsk-context-bar')
    for (const tone of ['ok', 'warn', 'critical'] as const) {
      expect(styles).toMatch(new RegExp(`\\.dsk-context-bar>span\\[data-tone=${tone}\\]\\{background:var\\(--dsw-alias-[a-z-]+\\)\\}`, 'u'))
    }
    // No literal color values leak into the status and progress rules.
    const surface = styles.split('.dsk-card[data-card-column=inbox]')[1]?.split('.dsk-root[data-density')[0] ?? ''
    expect(surface).not.toMatch(/(?:rgb|hsl|#)[0-9a-fA-F(]/u)
  })
})
