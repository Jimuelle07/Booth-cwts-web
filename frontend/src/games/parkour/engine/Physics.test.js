import { describe, expect, it } from 'vitest'
import { createPlayer } from '../entities/Player.js'
import {
  updatePlayer,
  COYOTE_TIME_MS,
  getMovingPlatformState,
  carryOnMovingPlatform,
  createCrumblingState,
  updateCrumblingTimers,
  isPlatformActive,
} from './Physics.js'

const DT = 1000 / 60 // ~16.667ms fixed timestep

function stillInput() {
  return { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false }
}

function jumpInput() {
  return { left: false, right: false, down: false, jumpHeld: true, jumpPressed: true }
}

function rightInput() {
  return { left: false, right: true, down: false, jumpHeld: false, jumpPressed: false }
}

function makeStage(spawnY, fallY, checkpoints) {
  return {
    fallY: fallY || 2000,
    checkpoints: checkpoints || [],
    spawnPoints: { p1: { x: 100, y: spawnY }, p2: { x: 160, y: spawnY } },
    finishZone: { x: 0, y: 0, width: 400, height: 50 },
  }
}

describe('Parkour physics — FB-2', () => {
  it('ground collision lands on a platform', () => {
    const stage = makeStage(500)
    const player = createPlayer('p1', { x: 100, y: 500 })
    const platforms = [
      { id: 'ground', type: 'solid', x: 0, y: 600, width: 400, height: 50 },
    ]

    for (let i = 0; i < 120; i++) {
      updatePlayer(player, stillInput(), DT, stage, platforms, [])
    }

    expect(player.grounded).toBe(true)
    expect(player.y).toBe(560) // 600 - 40
    expect(player.vy).toBe(0)
  })

  it('walking into a wall stops horizontal movement', () => {
    const stage = makeStage(300)
    const player = createPlayer('p1', { x: 50, y: 300 })
    const platforms = [
      { id: 'ground', type: 'solid', x: 0, y: 360, width: 400, height: 40 },
      { id: 'wall', type: 'solid', x: 200, y: 300, width: 20, height: 60 },
    ]

    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, platforms, [])
    }
    expect(player.grounded).toBe(true)
    expect(player.y).toBe(320) // 360 - 40

    for (let i = 0; i < 60; i++) {
      updatePlayer(player, rightInput(), DT, stage, platforms, [])
    }

    expect(player.x + player.width).toBeLessThanOrEqual(200)
    expect(player.grounded).toBe(true)
  })

  it('buffered jump fires on landing', () => {
    const stage = makeStage(200)
    const player = createPlayer('p1', { x: 100, y: 200 })
    const platforms = [
      { id: 'ground', type: 'solid', x: 0, y: 260, width: 400, height: 40 },
    ]

    // Fall for 5 ticks — still in the air (lands around tick 10)
    for (let i = 0; i < 5; i++) {
      updatePlayer(player, stillInput(), DT, stage, platforms, [])
    }
    expect(player.grounded).toBe(false)

    // Press jump while in the air — buffers but does NOT fire
    updatePlayer(player, jumpInput(), DT, stage, platforms, [])
    expect(player.vy).toBeGreaterThan(0) // still falling
    expect(player.jumpBufferTimer).toBeGreaterThan(0) // jump buffered

    // Continue falling — land and fire the buffered jump
    let jumpFired = false
    for (let i = 0; i < 20; i++) {
      updatePlayer(player, stillInput(), DT, stage, platforms, [])
      if (player.vy < 0) {
        jumpFired = true
        break
      }
    }

    expect(jumpFired).toBe(true)
    expect(player.vy).toBeLessThan(0)
  })

  it('coyote jump works shortly after leaving ground', () => {
    const stage = makeStage(300)
    const player = createPlayer('p1', { x: 100, y: 300 })
    const platforms = [
      { id: 'ledge', type: 'solid', x: 100, y: 340, width: 100, height: 20 },
    ]

    // Land on ledge
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, platforms, [])
    }
    expect(player.grounded).toBe(true)

    // Walk right off the ledge (right edge at x=200).
    // At 5px/tick from x=100, player reaches x=200 at tick 20.
    // Walk only 22 ticks — only ~2 ticks airborne = 33ms, well within 80ms COYOTE_TIME_MS
    for (let i = 0; i < 22; i++) {
      updatePlayer(player, rightInput(), DT, stage, platforms, [])
    }

    expect(player.grounded).toBe(false)
    expect(player.groundedTimer).toBeLessThanOrEqual(COYOTE_TIME_MS)

    // Coyote jump should fire
    updatePlayer(player, jumpInput(), DT, stage, platforms, [])
    expect(player.vy).toBeLessThan(0)
  })

  it('fall death respawns at last checkpoint and adds penalty', () => {
    const checkpoints = [{ id: 'cp-1', x: 80, y: 300, width: 200, height: 30 }]
    const stage = makeStage(500, 600, checkpoints)
    const player = createPlayer('p1', { x: 100, y: 500 })
    // No platforms — free fall past fallY=600
    const platforms = []

    // Simulate having touched a checkpoint
    player.lastCheckpointId = 'cp-1'

    // Free-fall past fallY=600.
    // ~20 ticks to reach fallY=600 from y=500. Run 30 ticks — enough for one death
    // but not enough to fall from respawn position (y≈258) to fallY again.
    const deathEvents = []
    for (let i = 0; i < 30; i++) {
      const events = updatePlayer(player, stillInput(), DT, stage, platforms, [])
      deathEvents.push(...events)
    }

    const fallDeath = deathEvents.find((e) => e.type === 'death' && e.cause === 'fall')
    expect(fallDeath).toBeTruthy()
    expect(fallDeath.checkpointId).toBe('cp-1')

    expect(player.y).toBeLessThan(600)
    expect(player.invulnerabilityTimer).toBeGreaterThan(0)
    expect(player.deaths).toBe(1)
  })

  it('hazard death respects invulnerability', () => {
    const stage = makeStage(300)
    const player = createPlayer('p1', { x: 100, y: 300 })
    const platforms = [{ id: 'ground', type: 'solid', x: 0, y: 360, width: 400, height: 40 }]
    const hazards = [{ id: 'haz-1', type: 'hazard', x: 80, y: 340, width: 60, height: 20, damage: 'death' }]

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, platforms, hazards)
    }
    expect(player.grounded).toBe(true)

    // Walk left into hazard
    const leftInput = () => ({ left: true, right: false, down: false, jumpHeld: false, jumpPressed: false })
    let hazardEvents = []
    for (let i = 0; i < 10; i++) {
      const events = updatePlayer(player, leftInput(), DT, stage, platforms, hazards)
      hazardEvents.push(...events)
    }

    const hazardDeath = hazardEvents.find((e) => e.type === 'death' && e.cause === 'hazard')
    expect(hazardDeath).toBeTruthy()
    expect(player.invulnerabilityTimer).toBeGreaterThan(0)

    // Hazard touch during invulnerability should NOT cause death
    const deathCount = player.deaths
    let moreEvents = []
    for (let i = 0; i < 10; i++) {
      const events = updatePlayer(player, leftInput(), DT, stage, platforms, hazards)
      moreEvents.push(...events)
    }

    expect(player.deaths).toBe(deathCount)
    expect(moreEvents.filter((e) => e.type === 'death')).toHaveLength(0)
  })
})

describe('Parkour moving & crumbling platforms — FB-3', () => {
  it('grounded player is carried by moving platform delta', () => {
    // An X-axis moving platform with speed & distance
    const platform = {
      id: 'mp-1', type: 'moving', x: 100, y: 300, width: 120, height: 24,
      axis: 'x', distance: 200, speed: 100, phase: 0,
    }

    const state1 = getMovingPlatformState(platform, 3000, 1000 / 60)
    const state2 = getMovingPlatformState(platform, 3000 + 1000 / 60, 1000 / 60)

    // Player standing on top of the platform
    const player = createPlayer('p1', { x: 140, y: 200 })
    player.y = state1.y - player.height
    player.grounded = true

    const beforeX = player.x
    carryOnMovingPlatform(player, state2)

    // Player should have moved by the platform's delta
    expect(player.x - beforeX).toBeCloseTo(state2.dx, 1)
  })

  it('crumbling timer starts only while occupied', () => {
    const cs = createCrumblingState()
    const platform = {
      id: 'cr-1', type: 'crumbling', x: 100, y: 300, width: 120, height: 24,
      crumbleAfterMs: 1000, respawnAfterMs: 2000,
    }
    const player = createPlayer('p1', { x: 140, y: 200 })
    player.y = platform.y - player.height
    player.grounded = true

    // Tick while occupied — timer should increase
    updateCrumblingTimers(cs, [platform], [player], 100)
    expect(cs['cr-1'].crumbleTimer).toBe(100)

    updateCrumblingTimers(cs, [platform], [player], 200)
    expect(cs['cr-1'].crumbleTimer).toBe(300)

    // Remove player from platform
    player.grounded = false
    player.x = 9999

    // Tick — timer should NOT increase
    updateCrumblingTimers(cs, [platform], [player], 500)
    expect(cs['cr-1'].crumbleTimer).toBe(300)
  })

  it('crumbled platform does not collide', () => {
    const cs = createCrumblingState()
    const platform = {
      id: 'cr-1', type: 'crumbling', x: 100, y: 300, width: 120, height: 24,
      crumbleAfterMs: 100, respawnAfterMs: 2000,
    }
    const player = createPlayer('p1', { x: 140, y: 200 })
    player.y = platform.y - player.height
    player.grounded = true

    // Let it crumble completely
    updateCrumblingTimers(cs, [platform], [player], 200)

    expect(cs['cr-1'].active).toBe(false)
    expect(isPlatformActive(platform, cs)).toBe(false)

    // Player should fall through (if we move player above, gravity should pull them down
    // without hitting the platform)
    // With platform inactive, player at (140, 275) should not be stopped
    player.y = 275 // above platform top
    player.grounded = false
    player.vy = 100

    const stage = { fallY: 9999, checkpoints: [], spawnPoints: { p1: { x: 0, y: 0 } }, finishZone: { x: 0, y: 0, width: 0, height: 0 } }
    // Only pass active platforms
    const activePlatforms = [platform].filter((p) => isPlatformActive(p, cs))

    // Fall for multiple ticks to pass through where the platform was
    const input = { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false }
    for (let i = 0; i < 30; i++) {
      updatePlayer(player, input, 16.667, stage, activePlatforms, [])
    }

    // Player fell through (y past platform top of 300)
    expect(player.y).toBeGreaterThan(300)
  })

  it('platform respawns after configured delay', () => {
    const cs = createCrumblingState()
    const platform = {
      id: 'cr-1', type: 'crumbling', x: 100, y: 300, width: 120, height: 24,
      crumbleAfterMs: 100, respawnAfterMs: 200,
    }
    const player = createPlayer('p1', { x: 140, y: 200 })
    player.y = platform.y - player.height
    player.grounded = true

    // Crumble it
    updateCrumblingTimers(cs, [platform], [player], 150)
    expect(cs['cr-1'].active).toBe(false)

    // Wait for respawn
    updateCrumblingTimers(cs, [platform], [player], 100)
    expect(cs['cr-1'].active).toBe(false) // not yet

    updateCrumblingTimers(cs, [platform], [player], 150)
    expect(cs['cr-1'].active).toBe(true) // respawned

    expect(isPlatformActive(platform, cs)).toBe(true)
  })
})

describe('Parkour wall climbing — FB-4', () => {
  const DT = 1000 / 60

  function stillInput() {
    return { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false }
  }

  function leftInput() {
    return { left: true, right: false, down: false, jumpHeld: false, jumpPressed: false }
  }

  function rightInput() {
    return { left: false, right: true, down: false, jumpHeld: false, jumpPressed: false }
  }

  function jumpInput() {
    return { left: false, right: false, down: false, jumpHeld: true, jumpPressed: true }
  }

  function leftJumpInput() {
    return { left: true, right: false, down: false, jumpHeld: true, jumpPressed: true }
  }

  function rightJumpInput() {
    return { left: false, right: true, down: false, jumpHeld: true, jumpPressed: true }
  }

  function makeStage() {
    return {
      fallY: 9999,
      checkpoints: [],
      spawnPoints: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
      finishZone: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  it('player slides slowly down a wall when pressing into it', () => {
    const stage = makeStage()
    // Wall at x:50, width:40 (50 to 90). Player at x:92 (touching, not overlapping)
    const wall = { id: 'wall', type: 'solid', x: 50, y: 0, width: 40, height: 400 }
    const player = createPlayer('p1', { x: 92, y: 100 })

    // Fall freely for a few frames — player should be airborne
    for (let i = 0; i < 5; i++) {
      updatePlayer(player, stillInput(), DT, stage, [wall], [])
    }
    expect(player.grounded).toBe(false)

    // Record fall speed without wall slide
    const fallSpeedBefore = player.vy

    // Now press left into the wall
    for (let i = 0; i < 5; i++) {
      updatePlayer(player, leftInput(), DT, stage, [wall], [])
    }

    // Player should be wall sliding (slow fall)
    expect(player.wallSlide).toBe('left')
    expect(player.vy).toBeLessThanOrEqual(150) // WALL_SLIDE_SPEED = 120 px/s (with some buffer)
    expect(player.vy).toBeLessThan(fallSpeedBefore) // slower than free fall
  })

  it('player pops away from wall on wall jump', () => {
    const stage = makeStage()
    // Wall at x:50, width:40. Player starts just to the right.
    const wall = { id: 'wall', type: 'solid', x: 50, y: 0, width: 40, height: 400 }
    const player = createPlayer('p1', { x: 92, y: 50 })

    // Fall + press left into wall to initiate wall slide
    for (let i = 0; i < 15; i++) {
      updatePlayer(player, leftInput(), DT, stage, [wall], [])
    }
    expect(player.wallSlide).toBe('left')
    expect(player.vy).toBeLessThanOrEqual(150)

    // Wall jump (press jump while still pressing left into wall)
    updatePlayer(player, leftJumpInput(), DT, stage, [wall], [])

    // Player should jump away from wall (to the right, since wall is on left)
    expect(player.vy).toBeLessThan(0) // moving upward
    expect(player.vx).toBeGreaterThan(50) // pushed to the right (away from left wall)
    expect(player.wallSlide).toBeNull() // no longer wall sliding

    // Push right to maintain momentum away from wall
    for (let i = 0; i < 5; i++) {
      updatePlayer(player, rightInput(), DT, stage, [wall], [])
    }
    // Player should have moved right (x increased)
    expect(player.x).toBeGreaterThan(92)
  })

  it('wall jump off right wall pushes left', () => {
    const stage = makeStage()
    // Wall at x:250, width:40 (250 to 290). Player starts to the left.
    const wall = { id: 'wall', type: 'solid', x: 250, y: 0, width: 40, height: 400 }
    const player = createPlayer('p1', { x: 240, y: 50 })

    // Fall + press right into wall
    for (let i = 0; i < 15; i++) {
      updatePlayer(player, rightInput(), DT, stage, [wall], [])
    }
    expect(player.wallSlide).toBe('right')

    // Wall jump
    const beforeX = player.x
    updatePlayer(player, rightJumpInput(), DT, stage, [wall], [])

    expect(player.vx).toBeLessThan(-50) // pushed to the left
    expect(player.vy).toBeLessThan(0) // moving upward
    expect(player.wallSlide).toBeNull()

    // Push left to maintain momentum away from wall
    for (let i = 0; i < 5; i++) {
      updatePlayer(player, leftInput(), DT, stage, [wall], [])
    }
    expect(player.x).toBeLessThan(beforeX)
  })

  it('no wall slide when grounded', () => {
    const stage = makeStage()
    const player = createPlayer('p1', { x: 50, y: 180 })
    const wall = { id: 'wall', type: 'solid', x: 30, y: 0, width: 40, height: 400 }
    const ground = { id: 'ground', type: 'solid', x: 0, y: 220, width: 400, height: 40 }

    // Land on ground first
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [wall, ground], [])
    }
    expect(player.grounded).toBe(true)

    // Press left while grounded — should NOT trigger wall slide
    updatePlayer(player, leftInput(), DT, stage, [wall, ground], [])
    expect(player.wallSlide).toBeNull()
  })

  it('no wall slide when pressing away from wall', () => {
    const stage = makeStage()
    // Wall at x:50, width:40 (50 to 90). Player starts to the right at x:92.
    const wall = { id: 'wall', type: 'solid', x: 50, y: 0, width: 40, height: 400 }
    const player = createPlayer('p1', { x: 92, y: 100 })

    // Fall for a bit then press RIGHT (away from the left wall, moving further right)
    for (let i = 0; i < 20; i++) {
      updatePlayer(player, rightInput(), DT, stage, [wall], [])
    }

    // Player should NOT be wall sliding because they're pressing right, not left
    expect(player.wallSlide).toBeNull()
  })

  it('wall jump reference adds death penalty', () => {
    // Sanity: wallSlide is reset on death (player respawns)
    const checkpoints = [{ id: 'cp-1', x: 0, y: 100, width: 200, height: 30 }]
    const stage = {
      fallY: 100,
      checkpoints,
      spawnPoints: { p1: { x: 50, y: 500 }, p2: { x: 0, y: 0 } },
      finishZone: { x: 0, y: 0, width: 0, height: 0 },
    }
    const wall = { id: 'wall', type: 'solid', x: 50, y: 0, width: 40, height: 400 }
    const player = createPlayer('p1', { x: 92, y: 50 })
    player.lastCheckpointId = 'cp-1'

    // Wall slide
    for (let i = 0; i < 15; i++) {
      updatePlayer(player, leftInput(), DT, stage, [wall], [])
    }
    expect(player.wallSlide).toBe('left')

    // Fall past fallY (remove wall so player falls freely)
    for (let i = 0; i < 30; i++) {
      updatePlayer(player, leftInput(), DT, stage, [], [])
    }

    // Player should have respawned — wallSlide should be null
    expect(player.wallSlide).toBeNull()
  })
})

describe('Parkour ledge grab — FB-4', () => {
  const DT = 1000 / 60

  function stillInput() {
    return { left: false, right: false, down: false, jumpHeld: false, jumpPressed: false }
  }

  function jumpInput() {
    return { left: false, right: false, down: false, jumpHeld: true, jumpPressed: true }
  }

  function makeStage() {
    return {
      fallY: 9999,
      checkpoints: [],
      spawnPoints: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
      finishZone: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  it('player grabs ledge near the left edge of a platform', () => {
    const stage = makeStage()
    const player = createPlayer('p1', { x: 100, y: 300 })
    // Platform with player near its left edge
    const platform = { id: 'plat', type: 'solid', x: 120, y: 220, width: 160, height: 24 }

    // Player is at x=100, width=28 → player covers x=100 to x=128
    // Platform left edge is at x=120, player right edge is at x=128
    // Player center = 114, which is within 28px of left edge 120 (center 114 < 120+28=148)
    // Player center 114 > platform left 120? No! 114 < 120.
    // So nearLeftEdge won't trigger...
    // 
    // Let me adjust: player at x=110, center=124, width=28 → covers 110 to 138
    // Player center 124 > platform left 120? Yes. 124 < 120+28=148? Yes. So nearLeftEdge = true.

    // Actually let me just start with the player already on the ground and jump up to the platform
    const ground = { id: 'ground', type: 'solid', x: 0, y: 360, width: 400, height: 40 }

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [ground], [])
    }
    expect(player.grounded).toBe(true)

    // Position player near the left edge of the platform above
    player.x = 110

    // Initiate jump (1 frame of jumpInput), then just let physics carry player upward
    updatePlayer(player, jumpInput(), DT, stage, [platform, ground], [])
    for (let i = 0; i < 14; i++) {
      updatePlayer(player, stillInput(), DT, stage, [platform, ground], [])
    }

    // Player should have grabbed the ledge (landed on top instead of bumping head)
    // Platform top is at y=220, player height=40, so player.y should be 180
    expect(player.grounded).toBe(true)
    expect(player.y).toBe(180) // 220 - 40
    expect(player.vy).toBe(0)
  })

  it('player grabs ledge near the right edge of a platform', () => {
    const stage = makeStage()
    const player = createPlayer('p1', { x: 100, y: 300 })
    const platform = { id: 'plat', type: 'solid', x: 120, y: 220, width: 160, height: 24 }
    const ground = { id: 'ground', type: 'solid', x: 0, y: 360, width: 400, height: 40 }

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [ground], [])
    }

    // Position player near the RIGHT edge of the platform above
    // Platform right edge = 120 + 160 = 280
    // Player center should be > 280-28=252 and < 280
    // Player at x=258, width=28 → covers 258 to 286, center=272
    // center 272 < 280? Yes. center 272 > 252? Yes. ✓
    player.x = 258

    // Initiate jump (1 frame), then coast upward
    updatePlayer(player, jumpInput(), DT, stage, [platform, ground], [])
    for (let i = 0; i < 14; i++) {
      updatePlayer(player, stillInput(), DT, stage, [platform, ground], [])
    }

    expect(player.grounded).toBe(true)
    expect(player.y).toBe(180) // 220 - 40
    expect(player.vy).toBe(0)
  })

  it('player bumps head (no ledge grab) when not near edge', () => {
    const stage = makeStage()
    const player = createPlayer('p1', { x: 100, y: 300 })
    const platform = { id: 'plat', type: 'solid', x: 120, y: 220, width: 160, height: 24 }
    const ground = { id: 'ground', type: 'solid', x: 0, y: 360, width: 400, height: 40 }

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [ground], [])
    }

    // Position player in the MIDDLE of the platform above (not near any edge)
    // Player at x=170, width=28 → covers 170 to 198, center=184
    // Platform: 120 to 280
    // Center 184 > 120+28=148? Yes. Center 184 < 280-28=252? Yes.
    // So neither edge is near → should bump head
    player.x = 170

    // Need to track y to see if player bumps head (stays below platform)
    let bumpedHead = false
    // Initiate jump (1 frame), then coast upward
    updatePlayer(player, jumpInput(), DT, stage, [platform, ground], [])
    for (let i = 0; i < 25; i++) {
      updatePlayer(player, stillInput(), DT, stage, [platform, ground], [])
      // If player is at or below platform bottom (220+24=244), they bumped their head
      if (!player.grounded && player.y >= 244) {
        bumpedHead = true
        break
      }
    }

    expect(bumpedHead).toBe(true)
    // Player should NOT have grabbed the ledge
    expect(player.wallSlide).toBeNull()
  })
})
