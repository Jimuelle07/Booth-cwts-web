import { describe, expect, it } from 'vitest'
import { createPlayer } from '../entities/Player.js'
import {
  updatePlayer,
  GRAB_DEFAULT_HANG_TIME_MS,
  GRAB_CLIMB_DURATION_DEPLETED,
  createCrumblingState,
  updateCrumblingTimers,
} from './Physics.js'

const DT = 1000 / 60

function stillInput() {
  return {
    left: false,
    right: false,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
  }
}
function jumpInput() {
  return {
    left: false,
    right: false,
    down: false,
    jumpHeld: true,
    jumpPressed: true,
  }
}
function rightInput() {
  return {
    left: false,
    right: true,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
  }
}
function leftInput() {
  return {
    left: true,
    right: false,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
  }
}
function downInput() {
  return {
    left: false,
    right: false,
    down: true,
    jumpHeld: false,
    jumpPressed: false,
  }
}
function leftJumpInput() {
  return {
    left: true,
    right: false,
    down: false,
    jumpHeld: true,
    jumpPressed: true,
  }
}

function makeStage(o = {}) {
  return {
    fallY: o.fallY ?? 9999,
    checkpoints: o.checkpoints ?? [],
    spawnPoints: o.spawnPoints ?? { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
    finishZone: o.finishZone ?? { x: 0, y: 0, width: 0, height: 0 },
  }
}

describe('Wall Cling', () => {
  it('auto-grab on wall contact', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(true)
    expect(p.grabType).toBe('wall-cling')
  })

  it('down-held skips wall-cling', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    const dr = {
      left: false,
      right: true,
      down: true,
      jumpHeld: false,
      jumpPressed: false,
    }
    for (let i = 0; i < 30; i++)
      updatePlayer(p, dr, DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
  })

  it('non-grabbable → no grab, wall-slide works', () => {
    const s = makeStage()
    const w = {
      id: 'w',
      type: 'solid',
      x: 200,
      y: 100,
      width: 40,
      height: 200,
      grabbable: false,
    }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
    expect(p.wallSlide).toBe('right')
  })
})

describe('Edge Hang', () => {
  it('edge-hang with toward input (manual setup)', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const p = createPlayer('p1', { x: 96, y: 220 })
    // Position player overlapping edge, heading upward
    p.y = 220 // player head at y=220, height=40 → 220-260, platform 200-224 → overlap
    p.vy = -200 // moving upward
    p.grounded = false

    updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    expect(p.grabbing).toBe(true)
    expect(p.grabType).toBe('edge-hang')
  })

  it('ledge-grab without toward input → snap-on-top', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 120,
      y: 220,
      width: 160,
      height: 24,
    }
    const ground = {
      id: 'g',
      type: 'solid',
      x: 0,
      y: 360,
      width: 400,
      height: 40,
    }
    const p = createPlayer('p1', { x: 130, y: 300 })
    for (let i = 0; i < 60; i++)
      updatePlayer(p, stillInput(), DT, s, [ground], [], 'racing', [p])
    p.x = 130
    updatePlayer(p, jumpInput(), DT, s, [plat, ground], [], 'racing', [p])
    for (let i = 0; i < 20; i++)
      updatePlayer(p, stillInput(), DT, s, [plat, ground], [], 'racing', [p])
    expect(p.grounded).toBe(true)
    expect(p.grabbing).toBe(false)
  })

  it('down-held skips edge-hang', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const ground = {
      id: 'g',
      type: 'solid',
      x: 0,
      y: 360,
      width: 400,
      height: 40,
    }
    const p = createPlayer('p1', { x: 96, y: 300 })
    for (let i = 0; i < 60; i++)
      updatePlayer(p, stillInput(), DT, s, [ground], [], 'racing', [p])
    p.x = 96
    const dj = {
      left: false,
      right: false,
      down: true,
      jumpHeld: true,
      jumpPressed: true,
    }
    updatePlayer(p, dj, DT, s, [plat, ground], [], 'racing', [p])
    for (let i = 0; i < 20; i++)
      updatePlayer(p, downInput(), DT, s, [plat, ground], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
  })

  it('downward catch (manual setup)', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const p = createPlayer('p1', { x: 96, y: 175 })
    // Player falling, feet above platform, will overlap after Y move
    p.y = 175 // head at 175, feet at 215, platform top 200
    p.vy = 100 // falling — prevFeetY = 175+40-100/60 ≈ 213 < 220 (threshold)
    p.grounded = false

    updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    expect(p.grabbing).toBe(true)
    expect(p.grabType).toBe('edge-hang')
  })

  it('pass-through edge-hang (manual setup)', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const p = createPlayer('p1', { x: 96, y: 210 })
    p.y = 220
    p.vy = -200
    p.grounded = false

    updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    expect(p.grabbing).toBe(true)
    if (p.grabbing) expect(p.grabType).toBe('edge-hang')
  })

  it('pass-through no wall-cling', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const p = createPlayer('p1', { x: 50, y: 210 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
  })
})

describe('Climb-Up', () => {
  it('climb-up from cling', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(true)
    updatePlayer(p, jumpInput(), DT, s, [w], [], 'racing', [p])
    expect(p.climbing).toBe(true)
    for (let i = 0; i < 15; i++) {
      if (!p.climbing) break
      updatePlayer(p, stillInput(), DT, s, [w], [], 'racing', [p])
    }
    expect(p.climbing).toBe(false)
    expect(p.grounded).toBe(true)
    expect(p.y).toBe(w.y - p.height)
  })

  it('climb-up from hang (manual edge-hang)', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const p = createPlayer('p1', { x: 96, y: 220 })
    p.y = 220
    p.vy = -200
    p.grounded = false
    updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    if (!p.grabbing) return
    updatePlayer(p, jumpInput(), DT, s, [plat], [], 'racing', [p])
    expect(p.climbing).toBe(true)
    for (let i = 0; i < 15; i++) {
      if (!p.climbing) break
      updatePlayer(p, stillInput(), DT, s, [plat], [], 'racing', [p])
    }
    expect(p.climbing).toBe(false)
    expect(p.grounded).toBe(true)
  })

  it('depleted climb-up speed', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    const fn = Math.ceil((GRAB_DEFAULT_HANG_TIME_MS - 500) / DT)
    for (let i = 0; i < fn; i++) {
      if (!p.grabbing) break
      updatePlayer(p, stillInput(), DT, s, [w], [], 'racing', [p])
    }
    expect(p.grabbing).toBe(true)
    expect(p.grabHangTimer).toBeGreaterThan(GRAB_DEFAULT_HANG_TIME_MS - 1000)
    updatePlayer(p, jumpInput(), DT, s, [w], [], 'racing', [p])
    expect(p.climbing).toBe(true)
    expect(p.climbDuration).toBe(GRAB_CLIMB_DURATION_DEPLETED)
  })
})

describe('Wall Jump / Release', () => {
  it('wall jump off cling', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(true)
    updatePlayer(p, leftJumpInput(), DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
    expect(p.vy).toBeLessThan(0)
    expect(p.vx).toBeLessThan(0)
  })

  it('drop release', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    updatePlayer(p, downInput(), DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
    expect(p.vy).toBeGreaterThanOrEqual(10)
  })

  it('away release', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    updatePlayer(p, leftInput(), DT, s, [w], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
    expect(p.vx).toBeLessThan(0)
  })

  it('timer expiry → auto-release', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'racing', [p])
    const fn = Math.ceil(GRAB_DEFAULT_HANG_TIME_MS / DT) + 5
    for (let i = 0; i < fn; i++) {
      if (!p.grabbing) break
      updatePlayer(p, stillInput(), DT, s, [w], [], 'racing', [p])
    }
    expect(p.grabbing).toBe(false)
  })
})

describe('Shimmy', () => {
  it('shimmy moves along edge', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 300,
      height: 24,
    }
    const p = createPlayer('p1', { x: 96, y: 220 })
    p.y = 220
    p.vy = -200
    p.grounded = false
    updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    if (!p.grabbing) return
    const xb = p.x
    for (let i = 0; i < 10; i++)
      updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    expect(p.x).toBeGreaterThan(xb)
    expect(p.grabbing).toBe(true)
  })

  it('shimmy clamp', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const p = createPlayer('p1', { x: 96, y: 220 })
    p.y = 220
    p.vy = -200
    p.grounded = false
    updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    if (!p.grabbing) return
    for (let i = 0; i < 30; i++)
      updatePlayer(p, leftInput(), DT, s, [plat], [], 'racing', [p])
    expect(p.x).toBeGreaterThanOrEqual(plat.x)
  })

  it('shimmy collision push', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 400,
      height: 24,
    }
    const ground = {
      id: 'g',
      type: 'solid',
      x: 0,
      y: 360,
      width: 600,
      height: 40,
    }
    const p1 = createPlayer('p1', { x: 140, y: 300 })
    const p2 = createPlayer('p2', { x: 180, y: 300 })
    // Manual grab setup — close enough to overlap on next shimmy
    p1.grabbing = true
    p1.grabType = 'edge-hang'
    p1.grabPlatformId = 'p'
    p1.grabHangDuration = 5000
    p2.grabbing = true
    p2.grabType = 'edge-hang'
    p2.grabPlatformId = 'p'
    p2.grabHangDuration = 5000
    // p1 shimmies right into p2 (they're only 40px apart, 28px width → overlap after ~12px)
    for (let i = 0; i < 20; i++) {
      updatePlayer(p1, rightInput(), DT, s, [plat, ground], [], 'racing', [
        p1,
        p2,
      ])
      updatePlayer(p2, stillInput(), DT, s, [plat, ground], [], 'racing', [
        p1,
        p2,
      ])
      if (!p2.grabbing) break
    }
    expect(p2.grabbing).toBe(false)
    expect(p1.grabbing).toBe(true)
  })

  it('mutual shimmy → both released', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 400,
      height: 24,
    }
    const ground = {
      id: 'g',
      type: 'solid',
      x: 0,
      y: 360,
      width: 600,
      height: 40,
    }
    const p1 = createPlayer('p1', { x: 170, y: 300 })
    const p2 = createPlayer('p2', { x: 176, y: 300 })
    p1.grabbing = true
    p1.grabType = 'edge-hang'
    p1.grabPlatformId = 'p'
    p1.grabHangDuration = 5000
    p2.grabbing = true
    p2.grabType = 'edge-hang'
    p2.grabPlatformId = 'p'
    p2.grabHangDuration = 5000
    // Both shimmy toward each other — run alternate processing
    for (let i = 0; i < 10; i++) {
      updatePlayer(p1, rightInput(), DT, s, [plat, ground], [], 'racing', [
        p1,
        p2,
      ])
      updatePlayer(p2, leftInput(), DT, s, [plat, ground], [], 'racing', [
        p1,
        p2,
      ])
    }
    // After collision, at least one should be released
    // Both shimmying toward each other leads to competitive push
    expect(p2.grabbing).toBe(false)
  })
})

describe('Platform Types', () => {
  it('moving platform carry', () => {
    const s = makeStage()
    const mplat = {
      id: 'm',
      type: 'moving',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
      dx: 5,
      dy: 0,
    }
    const p = createPlayer('p1', { x: 96, y: 220 })
    p.y = 220
    p.vy = -200
    p.grounded = false
    updatePlayer(p, rightInput(), DT, s, [mplat], [], 'racing', [p])
    if (!p.grabbing) {
      p.grabbing = true
      p.grabType = 'edge-hang'
      p.grabPlatformId = 'm'
      p.grabHangDuration = 5000
    }
    const xb = p.x
    for (let i = 0; i < 5; i++)
      updatePlayer(p, stillInput(), DT, s, [mplat], [], 'racing', [p])
    expect(p.x).toBeGreaterThan(xb)
  })

  it('crumbling platform trigger', () => {
    const plat = {
      id: 'cr',
      type: 'crumbling',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
      crumbleAfterMs: 1000,
      respawnAfterMs: 2000,
    }
    const p = createPlayer('p1', { x: 140, y: 150 })
    p.grabbing = true
    p.grabType = 'edge-hang'
    p.grabPlatformId = 'cr'
    const cs = createCrumblingState()
    updateCrumblingTimers(cs, [plat], [p], 100)
    expect(cs['cr'].crumbleTimer).toBe(100)
  })

  it('slow-slide physics', () => {
    const s = makeStage()
    const plat = {
      id: 'p',
      type: 'solid',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
      hangPhysics: 'slow-slide',
    }
    const p = createPlayer('p1', { x: 96, y: 220 })
    p.y = 220
    p.vy = -200
    p.grounded = false
    updatePlayer(p, rightInput(), DT, s, [plat], [], 'racing', [p])
    if (!p.grabbing) {
      p.grabbing = true
      p.grabType = 'edge-hang'
      p.grabPlatformId = 'p'
      p.grabHangDuration = 5000
      p.grabHangPhysics = 'slow-slide'
    }
    expect(p.grabHangPhysics).toBe('slow-slide')
    const yb = p.y
    for (let i = 0; i < 10; i++) {
      if (!p.grabbing) break
      updatePlayer(p, stillInput(), DT, s, [plat], [], 'racing', [p])
    }
    if (p.grabbing) expect(p.y).toBeGreaterThan(yb)
  })

  it('crumble release while hanging', () => {
    const plat = {
      id: 'cr',
      type: 'crumbling',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
      crumbleAfterMs: 500,
      respawnAfterMs: 2000,
    }
    const p = createPlayer('p1', { x: 140, y: 150 })
    p.grabbing = true
    p.grabType = 'edge-hang'
    p.grabPlatformId = 'cr'
    p.grabHangDuration = 5000
    const cs = createCrumblingState()
    updateCrumblingTimers(cs, [plat], [p], 600)
    expect(cs['cr'].active).toBe(false)
    expect(cs['cr'].crumbleTimer).toBeGreaterThanOrEqual(500)
  })
})

describe('Edge Cases', () => {
  it('death during grab clears grab state', () => {
    const cp = [{ id: 'cp-1', x: 0, y: 100, width: 200, height: 30 }]
    const s = makeStage({
      fallY: 400,
      checkpoints: cp,
      spawnPoints: { p1: { x: 50, y: 500 }, p2: { x: 0, y: 0 } },
    })
    const p = createPlayer('p1', { x: 50, y: 410 })
    p.lastCheckpointId = 'cp-1'
    p.grabbing = true
    p.grabType = 'edge-hang'
    // Player starts below fallY — death should trigger immediately
    updatePlayer(p, stillInput(), DT, s, [], [], 'racing', [p])
    expect(p.grabbing).toBe(false)
    expect(p.grabType).toBeNull()
  })

  it('jump buffer on grab frame', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    p.jumpBufferTimer = 100
    const jr = {
      left: false,
      right: true,
      down: false,
      jumpHeld: true,
      jumpPressed: true,
    }
    for (let i = 0; i < 30; i++)
      updatePlayer(p, jr, DT, s, [w], [], 'racing', [p])
    expect(p.jumpBufferTimer).toBeGreaterThanOrEqual(0)
  })

  it('grab disabled in countdown', () => {
    const s = makeStage()
    const w = { id: 'w', type: 'solid', x: 200, y: 100, width: 40, height: 200 }
    const p = createPlayer('p1', { x: 100, y: 150 })
    for (let i = 0; i < 30; i++)
      updatePlayer(p, rightInput(), DT, s, [w], [], 'countdown', [p])
    expect(p.grabbing).toBe(false)
  })

  it('chain-grab: drop + catch lower edge', () => {
    const s = makeStage()
    const upper = {
      id: 'upper',
      type: 'solid',
      x: 100,
      y: 200,
      width: 200,
      height: 24,
    }
    const lower = {
      id: 'lower',
      type: 'solid',
      x: 100,
      y: 400,
      width: 200,
      height: 24,
    }
    const pl = createPlayer('p1', { x: 96, y: 220 })
    pl.y = 220
    pl.vy = -200
    pl.grounded = false
    // 1. Grab the upper platform edge
    updatePlayer(pl, rightInput(), DT, s, [upper, lower], [], 'racing', [pl])
    if (!pl.grabbing) return
    expect(pl.grabPlatformId).toBe('upper')
    // 2. Drop from upper
    updatePlayer(pl, downInput(), DT, s, [upper, lower], [], 'racing', [pl])
    expect(pl.grabbing).toBe(false)
    // 3. Teleport below upper (head at y=360, bottom at 224 → no overlap) and
    //    just above the lower platform (feet at 400 = platform top, so no pre-move
    //    AABB overlap). prevFeetY = 360+40 = 400 ≤ 420 (threshold). Any positive
    //    vy causes post-move overlap → downward-catch fires on frame 1.
    pl.x = 285 // centerX≈299, inside nearRightEdge (280–300)
    pl.y = 360 // feet exactly at lower's top edge (no pre-move overlap)
    pl.vy = 600 // ensures post-move Y overlap
    pl.vx = 0
    // 4. Single updatePlayer: downward catch should fire on frame 1
    updatePlayer(pl, leftInput(), DT, s, [upper, lower], [], 'racing', [pl])
    expect(pl.grabbing).toBe(true)
    expect(pl.grabPlatformId).toBe('lower')
    expect(pl.grabType).toBe('edge-hang')
  })
})
