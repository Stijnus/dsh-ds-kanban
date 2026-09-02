/** Runtime publication throughput with 1,000 sessions and 20 active agents. */
import { bench, describe } from 'vitest'
import { createRuntimeSource } from '../src/client/runtime.ts'
import { createRuntimeHarness } from './helpers/runtime-harness.ts'

describe('1,000 sessions / 20 active agents', () => {
  const harness = createRuntimeHarness(1000)
  const source = createRuntimeSource(harness.sessions)
  const active = harness.ids.slice(0, 20).map(id => harness.faces.get(id)!)
  source.subscribe(() => { source.getSnapshot() })
  bench('20 changed lifecycle publications', () => {
    for (const face of active) {
      face.state.running = !face.state.running
      face.emit()
    }
  })
  bench('20 unchanged lifecycle publications', () => {
    for (const face of active) face.emit()
  })
})
