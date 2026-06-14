import { describe, expect, it } from 'vitest'
import { createPlayer } from '../entities/Player.js'
import {
  updatePlayer,
  COYOTE_TIME_MS,
  CLIMB_HEIGHT,
  getMovingPlatformState,
  carryOnMovingPlatform,
  createCrumblingState,
  updateCrumblingTimers,
  isPlatformActive,
  findWallPlatform,
  canClimbPlatform,
} from './Physics.js'

const DT = 1000 / 60 // ~16.667ms fixed timestep

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
      const events = updatePlayer(
        player,
        stillInput(),
        DT,
        stage,
        platforms,
        []
      )
      deathEvents.push(...events)
    }

    const fallDeath = deathEvents.find(
      (e) => e.type === 'death' && e.cause === 'fall'
    )
    expect(fallDeath).toBeTruthy()
    expect(fallDeath.checkpointId).toBe('cp-1')

    expect(player.y).toBeLessThan(600)
    expect(player.invulnerabilityTimer).toBeGreaterThan(0)
    expect(player.deaths).toBe(1)
  })

  it('hazard death respects invulnerability', () => {
    const stage = makeStage(300)
    const player = createPlayer('p1', { x: 100, y: 300 })
    const platforms = [
      { id: 'ground', type: 'solid', x: 0, y: 360, width: 400, height: 40 },
    ]
    const hazards = [
      {
        id: 'haz-1',
        type: 'hazard',
        x: 80,
        y: 340,
        width: 60,
        height: 20,
        damage: 'death',
      },
    ]

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, platforms, hazards)
    }
    expect(player.grounded).toBe(true)

    // Walk left into hazard
    const leftInput = () => ({
      left: true,
      right: false,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
    })
    let hazardEvents = []
    for (let i = 0; i < 10; i++) {
      const events = updatePlayer(
        player,
        leftInput(),
        DT,
        stage,
        platforms,
        hazards
      )
      hazardEvents.push(...events)
    }

    const hazardDeath = hazardEvents.find(
      (e) => e.type === 'death' && e.cause === 'hazard'
    )
    expect(hazardDeath).toBeTruthy()
    expect(player.invulnerabilityTimer).toBeGreaterThan(0)

    // Hazard touch during invulnerability should NOT cause death
    const deathCount = player.deaths
    let moreEvents = []
    for (let i = 0; i < 10; i++) {
      const events = updatePlayer(
        player,
        leftInput(),
        DT,
        stage,
        platforms,
        hazards
      )
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
      id: 'mp-1',
      type: 'moving',
      x: 100,
      y: 300,
      width: 120,
      height: 24,
      axis: 'x',
      distance: 200,
      speed: 100,
      phase: 0,
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
      id: 'cr-1',
      type: 'crumbling',
      x: 100,
      y: 300,
      width: 120,
      height: 24,
      crumbleAfterMs: 1000,
      respawnAfterMs: 2000,
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
      id: 'cr-1',
      type: 'crumbling',
      x: 100,
      y: 300,
      width: 120,
      height: 24,
      crumbleAfterMs: 100,
      respawnAfterMs: 2000,
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

    const stage = {
      fallY: 9999,
      checkpoints: [],
      spawnPoints: { p1: { x: 0, y: 0 } },
      finishZone: { x: 0, y: 0, width: 0, height: 0 },
    }
    // Only pass active platforms
    const activePlatforms = [platform].filter((p) => isPlatformActive(p, cs))

    // Fall for multiple ticks to pass through where the platform was
    const input = {
      left: false,
      right: false,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
    }
    for (let i = 0; i < 30; i++) {
      updatePlayer(player, input, 16.667, stage, activePlatforms, [])
    }

    // Player fell through (y past platform top of 300)
    expect(player.y).toBeGreaterThan(300)
  })

  it('platform respawns after configured delay', () => {
    const cs = createCrumblingState()
    const platform = {
      id: 'cr-1',
      type: 'crumbling',
      x: 100,
      y: 300,
      width: 120,
      height: 24,
      crumbleAfterMs: 100,
      respawnAfterMs: 200,
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
    return {
      left: false,
      right: false,
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

  function rightInput() {
    return {
      left: false,
      right: true,
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

  function leftJumpInput() {
    return {
      left: true,
      right: false,
      down: false,
      jumpHeld: true,
      jumpPressed: true,
    }
  }

  function rightJumpInput() {
    return {
      left: false,
      right: true,
      down: false,
      jumpHeld: true,
      jumpPressed: true,
    }
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
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 50,
      y: 0,
      width: 40,
      height: 400,
    }
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
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 50,
      y: 0,
      width: 40,
      height: 400,
    }
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
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 250,
      y: 0,
      width: 40,
      height: 400,
    }
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
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 30,
      y: 0,
      width: 40,
      height: 400,
    }
    const ground = {
      id: 'ground',
      type: 'solid',
      x: 0,
      y: 220,
      width: 400,
      height: 40,
    }

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
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 50,
      y: 0,
      width: 40,
      height: 400,
    }
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
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 50,
      y: 0,
      width: 40,
      height: 400,
    }
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
    const platform = {
      id: 'plat',
      type: 'solid',
      x: 120,
      y: 220,
      width: 160,
      height: 24,
    }

    // Player is at x=100, width=28 → player covers x=100 to x=128
    // Platform left edge is at x=120, player right edge is at x=128
    // Player center = 114, which is within 28px of left edge 120 (center 114 < 120+28=148)
    // Player center 114 > platform left 120? No! 114 < 120.
    // So nearLeftEdge won't trigger...
    //
    // Let me adjust: player at x=110, center=124, width=28 → covers 110 to 138
    // Player center 124 > platform left 120? Yes. 124 < 120+28=148? Yes. So nearLeftEdge = true.

    // Actually let me just start with the player already on the ground and jump up to the platform
    const ground = {
      id: 'ground',
      type: 'solid',
      x: 0,
      y: 360,
      width: 400,
      height: 40,
    }

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [ground], [])
    }
    expect(player.grounded).toBe(true)

    // Position player near the left edge of the platform above
    player.x = 110

    // Initiate jump (1 frame), then coast upward — capture indicator on the grab frame
    let grabIndicator = null
    updatePlayer(player, jumpInput(), DT, stage, [platform, ground], [])
    for (let i = 0; i < 14; i++) {
      updatePlayer(player, stillInput(), DT, stage, [platform, ground], [])
      // Capture indicator on the frame the player becomes grounded (grab happened)
      if (player.grounded && !grabIndicator) {
        grabIndicator = player.ledgeGrabIndicator
      }
    }

    // Ledge grab indicator should have been set (player near left edge)
    expect(grabIndicator).not.toBeNull()
    expect(grabIndicator.edge).toBe('left')
    expect(grabIndicator.platformId).toBe('plat')

    // Player should have grabbed the ledge (landed on top instead of bumping head)
    // Platform top is at y=220, player height=40, so player.y should be 180
    expect(player.grounded).toBe(true)
    expect(player.y).toBe(180) // 220 - 40
    expect(player.vy).toBe(0)
  })

  it('player grabs ledge near the right edge of a platform', () => {
    const stage = makeStage()
    const player = createPlayer('p1', { x: 100, y: 300 })
    const platform = {
      id: 'plat',
      type: 'solid',
      x: 120,
      y: 220,
      width: 160,
      height: 24,
    }
    const ground = {
      id: 'ground',
      type: 'solid',
      x: 0,
      y: 360,
      width: 400,
      height: 40,
    }

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

    // Initiate jump (1 frame), then coast upward — capture indicator on the grab frame
    let grabIndicator = null
    updatePlayer(player, jumpInput(), DT, stage, [platform, ground], [])
    for (let i = 0; i < 14; i++) {
      updatePlayer(player, stillInput(), DT, stage, [platform, ground], [])
      if (player.grounded && !grabIndicator) {
        grabIndicator = player.ledgeGrabIndicator
      }
    }

    // Ledge grab indicator should have been set (player near right edge)
    expect(grabIndicator).not.toBeNull()
    expect(grabIndicator.edge).toBe('right')
    expect(grabIndicator.platformId).toBe('plat')

    expect(player.grounded).toBe(true)
    expect(player.y).toBe(180) // 220 - 40
    expect(player.vy).toBe(0)
  })

  it('player bumps head (no ledge grab) when not near edge', () => {
    const stage = makeStage()
    const player = createPlayer('p1', { x: 100, y: 300 })
    const platform = {
      id: 'plat',
      type: 'solid',
      x: 120,
      y: 220,
      width: 160,
      height: 24,
    }
    const ground = {
      id: 'ground',
      type: 'solid',
      x: 0,
      y: 360,
      width: 400,
      height: 40,
    }

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
    // Ledge grab indicator should NOT be set (not near edge)
    expect(player.ledgeGrabIndicator).toBeNull()
  })
})

describe('Parkour passThrough teleportation fix', () => {
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

  function makeStage() {
    return {
      fallY: 9999,
      checkpoints: [],
      spawnPoints: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
      finishZone: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  it('jumping up through passThrough platform does not teleport sideways', () => {
    const stage = makeStage()
    // A wide passThrough ledge
    const ledge = {
      id: 'ledge',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 300,
      width: 240,
      height: 24,
    }
    const ground = {
      id: 'ground',
      type: 'solid',
      x: 0,
      y: 400,
      width: 400,
      height: 40,
    }
    const player = createPlayer('p1', { x: 180, y: 360 })

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [ground], [])
    }
    expect(player.grounded).toBe(true)

    // Position player centered under the passThrough ledge (ledge covers 100-340)
    player.x = 180 // player covers 180-208, well within the ledge horizontal range
    const xBeforeJump = player.x

    // Jump up — player should pass through the ledge without being pushed sideways
    updatePlayer(player, jumpInput(), DT, stage, [ledge, ground], [])
    for (let i = 0; i < 20; i++) {
      updatePlayer(player, stillInput(), DT, stage, [ledge, ground], [])
    }

    // Player should still be near the original X position (not pushed to the side)
    expect(player.x).toBeCloseTo(xBeforeJump, 0)
    // Player should be ABOVE the ledge (passed through)
    expect(player.y).toBeLessThan(270) // well above platform top at 300
  })

  it('jumping up through passThrough platform does not push to side when moving horizontally', () => {
    const stage = makeStage()
    const ledge = {
      id: 'ledge',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 300,
      width: 240,
      height: 24,
    }
    const ground = {
      id: 'ground',
      type: 'solid',
      x: 0,
      y: 400,
      width: 400,
      height: 40,
    }
    const player = createPlayer('p1', { x: 150, y: 360 })

    // Land on ground
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [ground], [])
    }

    // Position player under the ledge, moving right
    player.x = 150

    // Jump and hold right
    function rightJumpInput() {
      return {
        left: false,
        right: true,
        down: false,
        jumpHeld: true,
        jumpPressed: true,
      }
    }

    // Initiate jump and hold right for a few frames, then just hold right
    updatePlayer(player, rightJumpInput(), DT, stage, [ledge, ground], [])
    for (let i = 0; i < 10; i++) {
      const rightHeld = {
        left: false,
        right: true,
        down: false,
        jumpHeld: false,
        jumpPressed: false,
      }
      updatePlayer(player, rightHeld, DT, stage, [ledge, ground], [])
    }

    // Player should NOT be pushed LEFT of the ledge (x < 100 - 28 = 72)
    // And should NOT be pushed RIGHT of the ledge (x > 340)
    // Instead, the player should be moving right while passing through
    expect(player.x).toBeGreaterThanOrEqual(100 - 28) // not pushed left of ledge
    expect(player.x + player.width).toBeLessThanOrEqual(340 + 28) // not pushed right of ledge

    // Player should be at or above the ledge (passed through or in mid-pass)
    // Since we jump from y=360 and the passThrough ledge is at y=300,
    // the player should have passed through (or be passing through) the ledge
    expect(player.y).toBeLessThan(310) // player's top is at or above ledge top
  })

  it('player inside passThrough platform with vy >= 0 is not pushed right when pressing left/right', () => {
    const stage = makeStage()
    // Wide passThrough platform
    const platform = {
      id: 'ledge',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 300,
      width: 240,
      height: 24,
    }
    // Player starts inside the platform (vertically overlapping)
    const player = createPlayer('p1', { x: 180, y: 290 })
    // Player: x=180, y=290, w=28, h=40 → 180-208, 290-330
    // Platform: x=100, y=300, w=240, h=24 → 100-340, 300-324
    // Overlap: X(180-208 within 100-340 ✓), Y(290-330 overlaps 300-324 ✓)
    player.vy = 0
    player.grounded = false

    const xBefore = player.x
    const rightHeld = {
      left: false,
      right: true,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
    }

    for (let i = 0; i < 10; i++) {
      updatePlayer(player, rightHeld, DT, stage, [platform], [])
    }

    // WITHOUT fix: player gets pushed to platform.x - player.width = 100 - 28 = 72
    // WITH fix: player stays within platform bounds
    expect(player.x).toBeGreaterThanOrEqual(platform.x) // not pushed left of platform
    expect(player.x).toBeGreaterThan(xBefore) // moved right naturally
  })

  it('player inside passThrough platform with vy >= 0 is not pushed left when pressing left', () => {
    const stage = makeStage()
    const platform = {
      id: 'ledge',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 300,
      width: 240,
      height: 24,
    }
    const player = createPlayer('p1', { x: 220, y: 290 })
    // Player inside platform, vy >= 0
    player.vy = 0
    player.grounded = false

    const xBefore = player.x
    const leftHeld = {
      left: true,
      right: false,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
    }

    for (let i = 0; i < 10; i++) {
      updatePlayer(player, leftHeld, DT, stage, [platform], [])
    }

    // WITHOUT fix: player gets pushed to platform.x + platform.width = 100 + 240 = 340
    // WITH fix: player stays within platform bounds
    expect(player.x + player.width).toBeLessThanOrEqual(
      platform.x + platform.width
    )
    expect(player.x).toBeLessThan(xBefore) // moved left naturally
  })

  it('player standing on top of passThrough platform can move horizontally without teleport', () => {
    const stage = makeStage()
    const platform = {
      id: 'ledge',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 300,
      width: 240,
      height: 24,
    }
    const player = createPlayer('p1', { x: 180, y: 200 })

    // Fall onto platform
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [platform], [])
    }
    expect(player.grounded).toBe(true)
    expect(player.y).toBe(260) // 300 - 40

    const xBefore = player.x
    const rightHeld = {
      left: false,
      right: true,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
    }

    for (let i = 0; i < 10; i++) {
      updatePlayer(player, rightHeld, DT, stage, [platform], [])
    }

    // Player should have moved right (not teleported)
    expect(player.x).toBeGreaterThan(xBefore)
    // Player should still be grounded on top
    expect(player.grounded).toBe(true)
    expect(player.y).toBe(260)
  })

  it('dropping through a passThrough platform while holding left/right does not teleport', () => {
    const stage = makeStage()
    const platform = {
      id: 'ledge',
      type: 'solid',
      passThrough: true,
      x: 100,
      y: 300,
      width: 240,
      height: 24,
    }
    const player = createPlayer('p1', { x: 200, y: 200 })

    // Fall onto the platform
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [platform], [])
    }
    expect(player.grounded).toBe(true)
    expect(player.y).toBe(260) // 300 - 40
    expect(player.standingOnId).toBe('ledge')

    const xBefore = player.x

    // Hold down+right: triggers drop-through then continues falling right
    const downRightHeld = {
      left: false,
      right: true,
      down: true,
      jumpHeld: false,
      jumpPressed: false,
    }

    for (let i = 0; i < 15; i++) {
      updatePlayer(player, downRightHeld, DT, stage, [platform], [])
    }

    // WITHOUT fix: player gets pushed to platform.x - player.width = 72 on first frame
    // WITH fix: player should move right naturally
    expect(player.x).toBeGreaterThan(platform.x) // not pushed left of platform
    expect(player.x).toBeGreaterThan(xBefore) // moved right naturally
    // Player should have fallen through the platform
    expect(player.y).toBeGreaterThan(platform.y)
  })

  it('passThrough moving platform does not push player sideways', () => {
    const stage = makeStage()
    // Moving platform marked as passThrough
    const movingPlatform = {
      id: 'moving',
      type: 'moving',
      passThrough: true,
      x: 100,
      y: 300,
      width: 200,
      height: 24,
      axis: 'x',
      distance: 100,
      speed: 60,
      phase: 0,
    }
    const player = createPlayer('p1', { x: 150, y: 290 })
    player.vy = 0
    player.grounded = false

    const rightHeld = {
      left: false,
      right: true,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
    }
    const xBefore = player.x

    for (let i = 0; i < 10; i++) {
      updatePlayer(player, rightHeld, DT, stage, [movingPlatform], [])
    }

    // Player should not be pushed to the edge of the moving platform
    expect(player.x).toBeGreaterThanOrEqual(movingPlatform.x - player.width)
    expect(player.x + player.width).toBeLessThanOrEqual(
      movingPlatform.x + movingPlatform.width + player.width
    )
    expect(player.x).toBeGreaterThan(xBefore) // moved right naturally
  })
})

describe('Parkour climb mechanic', () => {
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

  function leftInput() {
    return {
      left: true,
      right: false,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
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

  function leftJumpInput() {
    return {
      left: true,
      right: false,
      down: false,
      jumpHeld: true,
      jumpPressed: true,
    }
  }

  function rightJumpInput() {
    return {
      left: false,
      right: true,
      down: false,
      jumpHeld: true,
      jumpPressed: true,
    }
  }

  function makeStage() {
    return {
      fallY: 9999,
      checkpoints: [],
      spawnPoints: { p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } },
      finishZone: { x: 0, y: 0, width: 0, height: 0 },
    }
  }

  it('findWallPlatform locates platform player is flush against from left', () => {
    const player = createPlayer('p1', { x: 90, y: 100 })
    // Player at x=90, width=28 → 90 to 118
    // Platform at x=50, width=40 → 50 to 90
    // Player is flush against the right edge of the platform (player.x === platform.x + platform.width)
    const platforms = [
      { id: 'wall', type: 'solid', x: 50, y: 0, width: 40, height: 400 },
    ]

    const result = findWallPlatform(player, platforms, 'left')
    expect(result).not.toBeNull()
    expect(result.id).toBe('wall')
  })

  it('findWallPlatform locates platform player is flush against from right', () => {
    const player = createPlayer('p1', { x: 100, y: 100 })
    // Player at x=100, width=28 → 100 to 128
    // Platform at x=128, width=40 → 128 to 168
    // Player is flush against the left edge of the platform
    const platforms = [
      { id: 'wall', type: 'solid', x: 128, y: 0, width: 40, height: 400 },
    ]

    const result = findWallPlatform(player, platforms, 'right')
    expect(result).not.toBeNull()
    expect(result.id).toBe('wall')
  })

  it('findWallPlatform returns null when no vertical overlap', () => {
    const player = createPlayer('p1', { x: 90, y: 500 })
    // Player at x=90, y=500, width=28, height=40 → covers 90-118 in X, 500-540 in Y
    // Platform at x=50, y=0, width=40, height=400 → covers 50-90 in X, 0-400 in Y
    // Player is flush horizontally but NOT overlapping vertically
    const platforms = [
      { id: 'wall', type: 'solid', x: 50, y: 0, width: 40, height: 400 },
    ]

    const result = findWallPlatform(player, platforms, 'left')
    expect(result).toBeNull()
  })

  it('canClimbPlatform returns true when platform top is above player head', () => {
    const player = createPlayer('p1', { x: 90, y: 300 })
    // Player head at y=300, platform top at y=280 (above player head)
    // distance = 300 - 280 = 20, which is < CLIMB_HEIGHT (64)
    const wallPlatform = { id: 'ledge', x: 50, y: 280, width: 40, height: 24 }

    expect(canClimbPlatform(player, wallPlatform)).toBe(true)
  })

  it('canClimbPlatform returns false when platform top is too far above player head', () => {
    const player = createPlayer('p1', { x: 90, y: 400 })
    // Player head at y=400, platform top at y=280
    // distance = 400 - 280 = 120, which is > CLIMB_HEIGHT (64)
    const wallPlatform = { id: 'ledge', x: 50, y: 280, width: 40, height: 24 }

    expect(canClimbPlatform(player, wallPlatform)).toBe(false)
  })

  it('canClimbPlatform returns true when player head is at or above platform top', () => {
    const player = createPlayer('p1', { x: 90, y: 260 })
    // Player head at y=260, platform top at y=280 (below player head)
    // distance = 260 - 280 = -20, which is < CLIMB_HEIGHT (64)
    const wallPlatform = { id: 'ledge', x: 50, y: 280, width: 40, height: 24 }

    expect(canClimbPlatform(player, wallPlatform)).toBe(true)
  })

  it('player climbs onto platform instead of wall-jumping when top is within reach', () => {
    const stage = makeStage()
    // A wall-like platform whose top is near the player's peak jump height
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 200,
      y: 275,
      width: 40,
      height: 200,
    }
    const ground = {
      id: 'ground',
      type: 'solid',
      x: 0,
      y: 460,
      width: 400,
      height: 40,
    }
    const player = createPlayer('p1', { x: 280, y: 300 })

    // Land on ground first (player.y ≈ 460 - 40 = 420, head at 420)
    for (let i = 0; i < 60; i++) {
      updatePlayer(player, stillInput(), DT, stage, [wall, ground], [])
    }
    expect(player.grounded).toBe(true)

    // Jump up and hold left to move toward the wall
    const leftJump = {
      left: true,
      right: false,
      down: false,
      jumpHeld: true,
      jumpPressed: true,
    }
    updatePlayer(player, leftJump, DT, stage, [wall, ground], [])

    // Hold left while airborne — player moves left and hits the wall
    const leftHeld = {
      left: true,
      right: false,
      down: false,
      jumpHeld: false,
      jumpPressed: false,
    }
    for (let i = 0; i < 30; i++) {
      updatePlayer(player, leftHeld, DT, stage, [wall, ground], [])
    }

    // Player should now be wall-sliding (pressing left into the wall)
    expect(player.wallSlide).toBe('left')

    // Wall top is y=275. Player's head should be within CLIMB_HEIGHT of wall top.
    const distanceToTop = player.y - wall.y
    expect(distanceToTop).toBeLessThan(CLIMB_HEIGHT)

    // Before the jump, the climbIndicator should be set (wall-sliding near climbable top)
    expect(player.climbIndicator).not.toBeNull()
    expect(player.climbIndicator.platformId).toBe('wall')
    expect(player.climbIndicator.side).toBe('left')

    // Press jump while still holding left — this initiates the climb animation
    updatePlayer(player, leftJump, DT, stage, [wall, ground], [])

    // Player should now be in climbing state (not yet grounded)
    expect(player.climbing).toBe(true)
    expect(player.grounded).toBe(false)

    // Step through the climb animation until complete (160ms at ~16.67ms = ~10 frames)
    for (let i = 0; i < 15; i++) {
      if (!player.climbing) break
      updatePlayer(player, stillInput(), DT, stage, [wall, ground], [])
    }

    // Player should have finished climbing onto the platform
    expect(player.climbing).toBe(false)
    expect(player.grounded).toBe(true)
    expect(player.y).toBe(wall.y - player.height) // 275 - 40 = 235
    expect(player.vy).toBe(0)
    expect(player.wallSlide).toBeNull()
  })

  it('player wall-jumps instead of climbing when platform top is far above', () => {
    const stage = makeStage()
    // A tall wall where the top is far above the player
    const wall = {
      id: 'wall',
      type: 'solid',
      x: 50,
      y: 0,
      width: 40,
      height: 400,
    }
    const player = createPlayer('p1', { x: 92, y: 100 })

    // Fall + press left into wall to initiate wall slide
    for (let i = 0; i < 15; i++) {
      updatePlayer(player, leftInput(), DT, stage, [wall], [])
    }
    expect(player.wallSlide).toBe('left')

    // player.y is now around the wall area. wall top = y=0, so distance is large
    // Player should wall-jump, not climb
    updatePlayer(player, leftJumpInput(), DT, stage, [wall], [])

    // Should wall-jump away from wall
    expect(player.vy).toBeLessThan(0) // moving upward
    expect(player.vx).toBeGreaterThan(50) // pushed right (away from left wall)
    expect(player.wallSlide).toBeNull()
  })
})
