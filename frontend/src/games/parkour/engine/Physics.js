export const GRAVITY = 1800 // px/s^2
export const HORIZONTAL_SPEED = 300 // px/s
export const JUMP_VELOCITY = -700 // px/s
export const MAX_FALL_SPEED = 1200 // px/s
export const COYOTE_TIME_MS = 80
export const JUMP_BUFFER_MS = 100
export const DEATH_RESPAWN_INVULNERABILITY_MS = 1000

import { respawnAtCheckpoint, respawnAtSpawn } from '../entities/Player.js'

export function aabbOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/**
 * Apply physics and input to a player for one fixed timestep.
 * Modifies the player in place. Returns an array of event objects
 * (e.g. [{ type: 'death', cause: 'fall', checkpointId: 'cp-1' }]).
 *
 * @param {object} player      - Player entity from createPlayer()
 * @param {object} input       - Input snapshot { left, right, down, jumpHeld, jumpPressed }
 * @param {number} dt          - Delta time in milliseconds
 * @param {object} stage       - Stage definition with fallY, checkpoints, spawnPoints, finishZone
 * @param {Array}  platforms   - Solid platform objects (includes walls)
 * @param {Array}  hazards     - Hazard objects
 * @returns {Array} events
 */
export function updatePlayer(player, input, dt, stage, platforms, hazards) {
  const events = []
  const dtSec = dt / 1000

  // Update timers
  // groundedTimer only counts time spent airborne (resets to 0 when grounded)
  if (!player.grounded) {
    player.groundedTimer += dt
  } else {
    player.groundedTimer = 0
  }
  player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
  player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt)

  // --- Drop through ---
  if (input.down && player.grounded && player.standingOnId) {
    player.dropThroughId = player.standingOnId
    player.y += 2
    player.grounded = false
  } else if (!input.down) {
    player.dropThroughId = null
  }

  // --- Horizontal input ---
  if (input.left) {
    player.vx = -HORIZONTAL_SPEED
    player.facingRight = false
  } else if (input.right) {
    player.vx = HORIZONTAL_SPEED
    player.facingRight = true
  } else {
    player.vx = 0
  }

  // --- Jump buffering ---
  if (input.jumpPressed) {
    player.jumpBufferTimer = JUMP_BUFFER_MS
  }

  // --- Apply gravity ---
  player.vy += GRAVITY * dtSec
  if (player.vy > MAX_FALL_SPEED) {
    player.vy = MAX_FALL_SPEED
  }

  // --- Discrete X then Y collision resolution ---
  // Move X
  player.x += player.vx * dtSec
  resolveCollisionAxis(player, platforms, 'x')

  // Move Y
  player.y += player.vy * dtSec
  const groundedBefore = player.grounded
  player.grounded = false
  resolveCollisionAxisY(player, platforms, dtSec)

  // --- Coyote time ---
  // If player was grounded this frame, reset the grounded timer
  if (player.grounded && !groundedBefore) {
    player.groundedTimer = 0
  }

  // --- Buffered jump ---
  if (player.jumpBufferTimer > 0 && (player.grounded || player.groundedTimer < COYOTE_TIME_MS)) {
    player.vy = JUMP_VELOCITY
    player.grounded = false
    // Exceed coyote threshold so it doesn't re-trigger on subsequent frames
    player.groundedTimer = COYOTE_TIME_MS + 1
    player.jumpBufferTimer = 0
  }

  // --- Fall death ---
  if (player.y > stage.fallY) {
    events.push({ type: 'death', cause: 'fall', checkpointId: player.lastCheckpointId })
    if (player.lastCheckpointId) {
      respawnAtCheckpoint(player, stage.checkpoints)
    } else {
      respawnAtSpawn(player, stage.spawnPoints[player.id])
    }
  }

  // --- Hazard death ---
  if (player.invulnerabilityTimer <= 0) {
    for (const hazard of hazards) {
      if (aabbOverlap(player, hazard)) {
        events.push({ type: 'death', cause: 'hazard', hazardId: hazard.id })
        if (player.lastCheckpointId) {
          respawnAtCheckpoint(player, stage.checkpoints)
        } else {
          respawnAtSpawn(player, stage.spawnPoints[player.id])
        }
        break
      }
    }
  }

  return events
}

/**
 * Resolve collisions along a single axis.
 * Pushes the player out of any overlapping platforms.
 */
function resolveCollisionAxis(player, platforms, axis) {
  for (const platform of platforms) {
    if (!aabbOverlap(player, platform)) continue

    if (player.vx > 0) {
      player.x = platform.x - player.width
    } else if (player.vx < 0) {
      player.x = platform.x + platform.width
    }
    player.vx = 0
  }
}

function resolveCollisionAxisY(player, platforms, dtSec) {
  for (const platform of platforms) {
    if (!aabbOverlap(player, platform)) continue

    if (player.vy > 0) {
      if (platform.passThrough && player.dropThroughId === platform.id) continue
      if (platform.passThrough) {
        const prevFeetY = player.y + player.height - player.vy * dtSec
        if (prevFeetY <= platform.y) {
          player.y = platform.y - player.height
          player.vy = 0
          player.grounded = true
          player.standingOnId = platform.id
        }
        continue
      }
      player.y = platform.y - player.height
      player.vy = 0
      player.grounded = true
      player.standingOnId = platform.id
    } else if (player.vy < 0) {
      if (platform.passThrough) continue
      player.y = platform.y + platform.height
      player.vy = 0
    }
  }
}

/**
 * Check if a player touches any checkpoint.
 * Updates the player's last checkpoint on first overlap.
 * Returns the touched checkpoint or null.
 */
export function touchCheckpoint(player, checkpoints) {
  for (const cp of checkpoints) {
    if (aabbOverlap(player, cp)) {
      if (player.lastCheckpointId !== cp.id) {
        player.lastCheckpointId = cp.id
        player.lastCheckpointX = cp.x + cp.width / 2 - player.width / 2
        player.lastCheckpointY = cp.y - player.height - 2
      }
      return cp
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Moving Platforms (FB-3)
// ---------------------------------------------------------------------------

/**
 * Compute the current offset of a moving platform from its base position.
 */
export function getMovingPlatformOffset(platform, stageTimeMs) {
  const t = (stageTimeMs / 1000) * platform.speed
  const rad = (t / (platform.distance || 1)) * Math.PI * 2 + platform.phase
  return Math.sin(rad) * (platform.distance / 2)
}

/**
 * Get the current (x, y) of a moving platform, and the delta from its previous
 * position one timestep ago. Returns {{ x, y, dx, dy }}.
 */
export function getMovingPlatformState(platform, stageTimeMs, dt) {
  const currOffset = getMovingPlatformOffset(platform, stageTimeMs)
  const prevOffset = getMovingPlatformOffset(platform, Math.max(0, stageTimeMs - dt))

  const currX = platform.x + (platform.axis === 'x' ? currOffset : 0)
  const currY = platform.y + (platform.axis === 'y' ? currOffset : 0)
  const prevX = platform.x + (platform.axis === 'x' ? prevOffset : 0)
  const prevY = platform.y + (platform.axis === 'y' ? prevOffset : 0)

  return {
    x: currX,
    y: currY,
    width: platform.width,
    height: platform.height,
    dx: currX - prevX,
    dy: currY - prevY,
  }
}

/**
 * Carry a grounded player by a moving platform's delta this tick.
 * The player must already be grounded and standing on the platform's surface.
 */
export function carryOnMovingPlatform(player, movingPlatformState) {
  player.x += movingPlatformState.dx
  player.y += movingPlatformState.dy
}

// ---------------------------------------------------------------------------
// Crumbling Platforms (FB-3)
// ---------------------------------------------------------------------------

/**
 * Create a fresh crumbling-state dictionary.
 */
export function createCrumblingState() {
  return {}
}

/**
 * Update crumbling platform timers.
 * crumblingPlatforms is the subset of platforms where type === 'crumbling'.
 * For each such platform, if any player is standing on it the crumble timer ticks up.
 * Once crumbleTimer >= crumbleAfterMs the platform becomes inactive.
 * After respawnAfterMs it becomes active again.
 */
export function updateCrumblingTimers(crumblingState, crumblingPlatforms, players, dt) {
  for (const platform of crumblingPlatforms) {
    let state = crumblingState[platform.id]
    if (!state) {
      state = { crumbleTimer: 0, respawnTimer: 0, active: true }
      crumblingState[platform.id] = state
    }

    if (state.active) {
      // Is any player standing on this platform?
      // Use proximity to top surface (within 2px) because aabbOverlap
      // returns false when the player's bottom edge equals the platform's top edge.
      const occupied = players.some(
        (p) =>
          p.grounded &&
          p.x < platform.x + platform.width &&
          p.x + p.width > platform.x &&
          Math.abs(p.y + p.height - platform.y) < 2,
      )
      if (occupied) {
        state.crumbleTimer += dt
        if (state.crumbleTimer >= platform.crumbleAfterMs) {
          state.active = false
          state.respawnTimer = 0
        }
      }
    } else {
      state.respawnTimer += dt
      if (state.respawnTimer >= platform.respawnAfterMs) {
        state.active = true
        state.crumbleTimer = 0
      }
    }
  }
}

/**
 * Returns true if the platform is active (solid) for collision purposes.
 * Non-crumbling platforms are always active.
 */
export function isPlatformActive(platform, crumblingState) {
  if (platform.type !== 'crumbling') return true
  const state = crumblingState[platform.id]
  return !state || state.active
}

/**
 * Filter crumbling platforms to only the currently-active ones.
 */
export function filterActivePlatforms(allPlatforms, crumblingState) {
  return allPlatforms.filter((p) => isPlatformActive(p, crumblingState))
}
