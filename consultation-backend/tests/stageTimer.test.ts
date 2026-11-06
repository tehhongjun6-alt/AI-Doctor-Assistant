import { describe, expect, it } from 'vitest'
import { createStageTimer } from '../src/services/stageTimer.js'

describe('createStageTimer (Step 2)', () => {
  it('records stage durations and total using fake clock', () => {
    const times = [0, 120, 450]
    let index = 0
    const fakeNow = () => times[index++]

    const timer = createStageTimer(fakeNow)
    timer.mark('a')
    timer.mark('b')

    expect(timer.result()).toEqual({ a: 120, b: 330, total: 450 })
  })
})
