import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDeathPenalty,
  attachRenderer,
  calculateFinalResult,
  calculatePlayerStageTime,
  createStageResult,
  detachRenderer,
  dispose,
  expireDnf,
  getSnapshot,
  recordStageFinish,
  resetRun,
  restartRun,
  tick,
} from './State'

describe('Parkour state foundation', () => {
  afterEach(() => {
    dispose()
  })

  it('attaches and detaches renderers without resetting a live run while one renderer remains', () => {
    resetRun({
      player1: { name: 'Ada', avatarKey: 'joy' },
      player2: { name: 'Lin', avatarKey: 'anger' },
    })

    attachRenderer({ panelSlot: 'left', playerId: 'p1', canvas: { id: 'canvas-left' } })
    attachRenderer({ panelSlot: 'right', playerId: 'p2', canvas: { id: 'canvas-right' } })

    const beforeDetach = getSnapshot()
    expect(beforeDetach.rendererCount).toBe(2)
    expect(beforeDetach.phase).toBe('countdown')

    detachRenderer('left')

    const afterDetach = getSnapshot()
    expect(afterDetach.rendererCount).toBe(1)
    expect(afterDetach.phase).toBe('countdown')
    expect(afterDetach.runId).toBe(beforeDetach.runId)
  })

  it('records same-tick finishes without starting a DNF timer', () => {
    const result = recordStageFinish(createStageResult('stage-1'), { p1: true, p2: true }, 12345)

    expect(result.players.p1).toMatchObject({ finished: true, finishTimeMs: 12345, dnf: false })
    expect(result.players.p2).toMatchObject({ finished: true, finishTimeMs: 12345, dnf: false })
    expect(result.dnfCountdown).toBeNull()
    expect(result.completed).toBe(true)
  })

  it('expires the DNF timer and keeps totals numeric', () => {
    const firstFinish = recordStageFinish(createStageResult('stage-1'), { p1: true }, 10000)

    expect(firstFinish.dnfCountdown).toEqual({
      playerId: 'p2',
      startedAtMs: 10000,
      expiresAtMs: 25000,
    })

    const notExpired = expireDnf(firstFinish, 24999)
    expect(notExpired.players.p2.dnf).toBe(false)

    const expired = expireDnf(firstFinish, 25000)
    expect(expired.players.p2.dnf).toBe(true)
    expect(expired.completed).toBe(true)
    expect(calculatePlayerStageTime(expired, 'p2')).toBe(25000)
  })

  it('calculates final winners and exact ties from stage totals', () => {
    const stageOne = recordStageFinish(createStageResult('stage-1'), { p1: true, p2: true }, 10000)
    const stageTwo = addDeathPenalty(
      recordStageFinish(createStageResult('stage-2'), { p1: true, p2: true }, 12000),
      'p1',
      'cp-1',
    )
    const stageThree = addDeathPenalty(
      recordStageFinish(createStageResult('stage-3'), { p1: true, p2: true }, 15000),
      'p2',
      'cp-2',
    )

    const finalResult = calculateFinalResult([stageOne, stageTwo, stageThree])

    expect(finalResult.totals).toEqual({ p1: 40000, p2: 40000 })
    expect(finalResult.winner).toBe('tie')
  })

  it('starts the loop only once for duplicate start calls', () => {
    const requestAnimationFrame = vi.fn(() => 42)
    const cancelAnimationFrame = vi.fn()

    attachRenderer({ panelSlot: 'left', playerId: 'p1', canvas: { id: 'canvas-left' } })
    getSnapshot().loopControls.start({ requestAnimationFrame, cancelAnimationFrame })
    getSnapshot().loopControls.start({ requestAnimationFrame, cancelAnimationFrame })

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
  })
})

describe('Parkour state machine — FB-1', () => {
  afterEach(() => {
    dispose()
  })

  it('countdown time does not count toward race time', () => {
    resetRun({ player1: { name: 'Ada', avatarKey: 'joy' }, player2: { name: 'Lin', avatarKey: 'anger' } })

    expect(getSnapshot().phase).toBe('countdown')
    expect(getSnapshot().raceTimeMs).toBe(0)

    // Advance 2000ms during countdown — raceTimeMs stays 0
    tick(1000, {})
    expect(getSnapshot().phase).toBe('countdown')
    expect(getSnapshot().raceTimeMs).toBe(0)

    tick(1000, {})
    expect(getSnapshot().phase).toBe('countdown')
    expect(getSnapshot().raceTimeMs).toBe(0)

    // Advance past 3000ms total → transitions to racing
    tick(1000, {})
    expect(getSnapshot().phase).toBe('racing')
    expect(getSnapshot().raceTimeMs).toBe(0)

    // Now time counts
    tick(500, {})
    expect(getSnapshot().raceTimeMs).toBe(500)
  })

  it('stage advances after both players finish', () => {
    resetRun({ player1: { name: 'Ada', avatarKey: 'joy' }, player2: { name: 'Lin', avatarKey: 'anger' } })

    // Advance through countdown to racing
    tick(3000, {})
    expect(getSnapshot().phase).toBe('racing')
    expect(getSnapshot().currentStageIndex).toBe(0)

    // Both finish in the same tick
    tick(5000, { p1: true, p2: true })
    expect(getSnapshot().phase).toBe('stageComplete')
    expect(getSnapshot().stageResults).toHaveLength(1)
    expect(getSnapshot().stageResults[0].players.p1.finished).toBe(true)
    expect(getSnapshot().stageResults[0].players.p2.finished).toBe(true)

    // Wait for stage results display (3000ms)
    tick(3000, {})
    expect(getSnapshot().phase).toBe('countdown')
    expect(getSnapshot().currentStageIndex).toBe(1)
  })

  it('stage advances after one finish and one DNF', () => {
    resetRun({ player1: { name: 'Ada', avatarKey: 'joy' }, player2: { name: 'Lin', avatarKey: 'anger' } })

    tick(3000, {}) // → racing

    // P1 finishes at race time 10000
    tick(10000, { p1: true })
    expect(getSnapshot().phase).toBe('racing') // Still racing — waiting for DNF

    const result = getSnapshot().stageResults[0]
    expect(result.dnfCountdown).not.toBeNull()
    expect(result.dnfCountdown.playerId).toBe('p2')
    expect(result.dnfCountdown.startedAtMs).toBe(10000)
    expect(result.dnfCountdown.expiresAtMs).toBe(25000)

    // Advance to just before DNF expiry
    tick(14999, {})
    expect(getSnapshot().phase).toBe('racing')

    // Advance past DNF expiry
    tick(1, {}) // total race time = 25000
    expect(getSnapshot().phase).toBe('stageComplete')
    expect(getSnapshot().stageResults[0].completed).toBe(true)
    expect(getSnapshot().stageResults[0].players.p2.dnf).toBe(true)
  })

  it('after stage 3, state becomes gameOver', () => {
    resetRun({ player1: { name: 'Ada', avatarKey: 'joy' }, player2: { name: 'Lin', avatarKey: 'anger' } })

    // Stage 1
    tick(3000, {}) // → racing
    tick(5000, { p1: true, p2: true })
    tick(3000, {}) // → countdown stage 2

    // Stage 2
    tick(3000, {}) // → racing
    tick(8000, { p1: true, p2: true })
    tick(3000, {}) // → countdown stage 3

    // Stage 3
    tick(3000, {}) // → racing
    tick(7000, { p1: true, p2: true })
    tick(3000, {}) // → gameOver

    expect(getSnapshot().phase).toBe('gameOver')
    expect(getSnapshot().stageResults).toHaveLength(3)
  })

  it('restart creates fresh stage scores', () => {
    resetRun({ player1: { name: 'Ada', avatarKey: 'joy' }, player2: { name: 'Lin', avatarKey: 'anger' } })

    // Complete stage 1 and advance to stage 2
    tick(3000, {}) // → racing
    tick(5000, { p1: true, p2: true })
    tick(3000, {}) // → countdown stage 2

    expect(getSnapshot().stageResults).toHaveLength(1)
    expect(getSnapshot().currentStageIndex).toBe(1)

    // Restart
    restartRun()

    expect(getSnapshot().phase).toBe('countdown')
    expect(getSnapshot().currentStageIndex).toBe(0)
    expect(getSnapshot().stageResults).toHaveLength(0)
    expect(getSnapshot().raceTimeMs).toBe(0)
  })
})
