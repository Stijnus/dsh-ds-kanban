import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('browser bundle compatibility', () => {
  it('uses the Harness loader and only supported browser externals', () => {
    const artifact = fileURLToPath(new URL('../lib/client.js', import.meta.url))
    const source = readFileSync(artifact, 'utf8')
    expect(source).toContain('window.__ModuleLoader__.load')
    expect(source).not.toContain('@deepseek-ai/dsh-client-runtime')
    expect(source).not.toContain('@deepseek-ai/schemastery')
    const required = [...source.matchAll(/require\("([^"]+)"\)/gu)].map(match => match[1])
    expect(new Set(required)).toEqual(new Set([
      'react', 'react/jsx-runtime', 'react-dom',
      '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives',
    ]))
  })
})
