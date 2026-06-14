export const GRAVITY = 1800 // px/s^2
export const HORIZONTAL_SPEED = 300 // px/s
export const JUMP_VELOCITY = -700 // px/s
export const MAX_FALL_SPEED = 1200 // px/s
export const COYOTE_TIME_MS = 80
export const JUMP_BUFFER_MS = 100
export const DEATH_RESPAWN_INVULNERABILITY_MS = 1000
export const WALL_SLIDE_SPEED = 120 // px/s — reduced fall when wall sliding
export const WALL_JUMP_VELOCITY_X = 280 // px/s — horizontal push away from wall
export const WALL_JUMP_VELOCITY_Y = -650 // px/s — upward boost off the wall
export const LEDGE_GRAB_THRESHOLD = 28 // px — max distance from platform edge for ledge grab
export const CLIMB_HEIGHT = 80 // px — max distance from player's head to platform top for climbing

// Grab & Climb constants
export const GRAB_SHIMMY_SPEED = 150 // px/s — horizontal movement while edge-hanging
export const GRAB_SLOW_SLIDE_SPEED = 120 // px/s — descent speed in slow-slide hang mode
export const GRAB_DEFAULT_HANG_TIME_MS = 5000 // ms — default hang duration (5 seconds)
export const GRAB_CRUMBLING_HANG_TIME_MS = 3000 // ms — hang duration for crumbling platforms (3 seconds)
export const GRAB_EDGE_DETECT_THRESHOLD = 20 // px — max distance from platform top edge for edge-hang vs wall-cling
export const GRAB_CLIMB_DURATION = 160 // ms — normal climb-up animation duration
export const GRAB_CLIMB_DURATION_DEPLETED = 100 // ms — climb-up when hang timer < 1s remaining
export const GRAB_LOW_TIME_WARNING_MS = 1000 // ms — when pulse warning starts before auto-release
export const GRAB_RELEASE_VELOCITY = 10 // px/s — small downward velocity on release to prevent re-grab

import { respawnAtCheckpoint, respawnAtSpawn } from '../entities/Player.js'

function clearGrabState(player) {
  player.grabbing = false
  player.grabType = null
  player.grabPlatformId = null
  player.grabHangTimer = 0
  player.grabHangDuration = 5000
  player.grabHangPhysics = 'motionless'
  player.grabSide = null
  player._justGrabbed = false
}

function isPlatformGrabbable(platform) {
  return platform.grabbable !== false
}

function isMovingPlatform(platform) {
  return platform.type === 'moving'
}

function isCrumblingPlatform(platform) {
  return platform.type === 'crumbling'
}

function getPlatformById(platforms, id) {
  return platforms.find((p) => p.id === id) || null
}

function isNearPlatformEdge(playerCenterX, platform, threshold) {
  const nearLeftEdge =
    playerCenterX > platform.x && playerCenterX < platform.x + threshold
  const nearRightEdge =
    playerCenterX < platform.x + platform.width &&
    playerCenterX > platform.x + platform.width - threshold
  return { nearLeftEdge, nearRightEdge }
}

function isPressingTowardPlatform(player, platform, input) {
  const playerCenterX = player.x + player.width / 2
  const platCenterX = platform.x + platform.width / 2
  const towardThreshold = 10

  // If within 10px of platform center, either direction counts as "toward"
  if (Math.abs(playerCenterX - platCenterX) < towardThreshold) {
    return true
  }

  if (playerCenterX < platCenterX) {
    return input.right
  }
  return input.left
}

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
 * @param {string} [phase='racing'] - Game phase: 'racing'|'countdown'|'stageComplete'
 * @param {Array}  [allPlayers=[]]  - All player objects for shimmy collision
 * @returns {Array} events
 */
export function updatePlayer(
  player,
  input,
  dt,
  stage,
  platforms,
  hazards,
  phase = 'racing',
  allPlayers = []
) {
  const events = []
  const dtSec = dt / 1000

  // Clear visual indicators for this frame
  player.ledgeGrabIndicator = null
  player.climbIndicator = null

  // --- Climb animation ---
  // When climbing, lerp the player's Y toward the target with ease-out.
  // Skip all other physics (gravity, input, collision) during the climb.
  if (player.climbing) {
    player.climbTimer += dt
    const t = Math.min(1, player.climbTimer / player.climbDuration)
    // Ease out quad — decelerates toward the top for a natural feel
    const eased = 1 - (1 - t) * (1 - t)
    player.y =
      player.climbStartY + (player.climbTargetY - player.climbStartY) * eased
    player.vy = 0

    if (t >= 1) {
      player.y = player.climbTargetY
      player.climbing = false
      player.grounded = true
      player.groundedTimer = 0
      player.standingOnId = player.climbWallPlatformId
      player.climbWallPlatformId = null
    }

    // Still check death during climb (unlikely but safe)
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
    player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt)
    if (player.y > stage.fallY) {
      events.push({
        type: 'death',
        cause: 'fall',
        checkpointId: player.lastCheckpointId,
      })
      if (player.lastCheckpointId) {
        respawnAtCheckpoint(player, stage.checkpoints)
      } else {
        respawnAtSpawn(player, stage.spawnPoints[player.id])
      }
    }
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

  // --- Grab physics block ---
  // Active when player is grabbing (wall-cling or edge-hang) and phase is racing.
  if (player.grabbing && phase === 'racing') {
    // Emit contact event if just entered grab state in this frame
    if (player._justGrabbed) {
      player._justGrabbed = false
      events.push({ type: 'grab', x: player.x + player.width / 2, y: player.y })
    }
    const dtSec = dt / 1000

    // 1. Update hang timer
    player.grabHangTimer += dt
    const hangDuration = player.grabHangDuration
    if (hangDuration > 0 && player.grabHangTimer >= hangDuration) {
      // Auto-release on timer expiry
      clearGrabState(player)
      player.vy = GRAB_RELEASE_VELOCITY
      player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
      player.invulnerabilityTimer = Math.max(
        0,
        player.invulnerabilityTimer - dt
      )
      // Check death
      if (player.y > stage.fallY) {
        events.push({
          type: 'death',
          cause: 'fall',
          checkpointId: player.lastCheckpointId,
        })
        if (player.lastCheckpointId)
          respawnAtCheckpoint(player, stage.checkpoints)
        else respawnAtSpawn(player, stage.spawnPoints[player.id])
      }
      return events
    }

    // 2. Update jump buffer
    player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
    if (input.jumpPressed) {
      player.jumpBufferTimer = JUMP_BUFFER_MS
    }

    // 3. Determine away direction
    const awayFromWall =
      (player.grabSide === 'left' && input.right) ||
      (player.grabSide === 'right' && input.left)

    // 4. Climb-up or Wall-jump (if jump buffer available) — highest priority with jump
    if (player.jumpBufferTimer > 0) {
      player.jumpBufferTimer = 0
      if (player.grabType === 'wall-cling' && awayFromWall) {
        // Wall jump off cling
        const awayX =
          player.grabSide === 'right'
            ? -WALL_JUMP_VELOCITY_X
            : WALL_JUMP_VELOCITY_X
        player.vx = awayX
        player.vy = WALL_JUMP_VELOCITY_Y
        clearGrabState(player)
        player.invulnerabilityTimer = Math.max(
          0,
          player.invulnerabilityTimer - dt
        )
        return events
      } else {
        // Climb up
        const grabPlatform = getPlatformById(platforms, player.grabPlatformId)
        if (grabPlatform) {
          const depleted =
            hangDuration > 0 &&
            player.grabHangTimer > hangDuration - GRAB_LOW_TIME_WARNING_MS
          player.climbing = true
          player.climbStartY = player.y
          player.climbTargetY = grabPlatform.y - player.height
          player.climbTimer = 0
          player.climbDuration = depleted
            ? GRAB_CLIMB_DURATION_DEPLETED
            : GRAB_CLIMB_DURATION
          player.climbWallPlatformId = grabPlatform.id
        }
        clearGrabState(player)
        player.vx = 0
        player.vy = 0
        player.grounded = false
        player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
        player.invulnerabilityTimer = Math.max(
          0,
          player.invulnerabilityTimer - dt
        )
        return events
      }
    }

    // 5. Release (down or away) — only if jump buffer didn't fire
    if (input.down || awayFromWall) {
      const releaseSide = player.grabSide
      clearGrabState(player)
      player.vy = GRAB_RELEASE_VELOCITY
      if (awayFromWall) {
        player.vx =
          releaseSide === 'right' ? -HORIZONTAL_SPEED : HORIZONTAL_SPEED
      }
      player.invulnerabilityTimer = Math.max(
        0,
        player.invulnerabilityTimer - dt
      )
      return events
    }

    // 6. Shimmy (edge-hang only)
    if (player.grabType === 'edge-hang') {
      let shimmyVx = 0
      if (input.left) shimmyVx = -GRAB_SHIMMY_SPEED
      else if (input.right) shimmyVx = GRAB_SHIMMY_SPEED

      if (shimmyVx !== 0) {
        player.x += shimmyVx * dtSec
        // Clamp to platform bounds
        const grabPlatform = getPlatformById(platforms, player.grabPlatformId)
        if (grabPlatform) {
          if (player.x < grabPlatform.x) player.x = grabPlatform.x
          if (player.x + player.width > grabPlatform.x + grabPlatform.width)
            player.x = grabPlatform.x + grabPlatform.width - player.width
        }

        // Player-player shimmy collision
        for (const other of allPlayers) {
          if (other === player) continue
          if (
            other.grabbing &&
            other.grabType === 'edge-hang' &&
            other.grabPlatformId === player.grabPlatformId &&
            aabbOverlap(player, other)
          ) {
            // Push the other player off
            clearGrabState(other)
            other.vy = GRAB_RELEASE_VELOCITY
          }
        }
      }
      player.vx = 0
    } else {
      player.vx = 0
    }

    player.vy = 0

    // 7. Slow-slide physics
    if (player.grabHangPhysics === 'slow-slide') {
      player.y += GRAB_SLOW_SLIDE_SPEED * dtSec
      const slowSlidePlatform = getPlatformById(
        platforms,
        player.grabPlatformId
      )
      if (
        slowSlidePlatform &&
        player.y + player.height >
          slowSlidePlatform.y + slowSlidePlatform.height
      ) {
        clearGrabState(player)
        player.vy = GRAB_RELEASE_VELOCITY
        player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt)
        player.invulnerabilityTimer = Math.max(
          0,
          player.invulnerabilityTimer - dt
        )
        return events
      }
    }

    // 8. Moving platform carry
    const carryPlatform = getPlatformById(platforms, player.grabPlatformId)
    if (carryPlatform && isMovingPlatform(carryPlatform)) {
      if (carryPlatform.dx !== undefined) {
        player.x += carryPlatform.dx
        player.y += carryPlatform.dy
      }
    }

    // 10. Timers & death checks
    player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt)
    if (player.y > stage.fallY) {
      events.push({
        type: 'death',
        cause: 'fall',
        checkpointId: player.lastCheckpointId,
      })
      if (player.lastCheckpointId)
        respawnAtCheckpoint(player, stage.checkpoints)
      else respawnAtSpawn(player, stage.spawnPoints[player.id])
    }
    if (player.invulnerabilityTimer <= 0) {
      for (const hazard of hazards) {
        if (aabbOverlap(player, hazard)) {
          events.push({ type: 'death', cause: 'hazard', hazardId: hazard.id })
          if (player.lastCheckpointId)
            respawnAtCheckpoint(player, stage.checkpoints)
          else respawnAtSpawn(player, stage.spawnPoints[player.id])
          break
        }
      }
    }
    return events
  }

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
  const wallSlideResult = resolveCollisionAxis(player, platforms, input, phase)

  // If grab was established during X collision, skip wall-slide and jump directly to grab handling
  if (player.grabbing) {
    // Clear wall slide since grab takes priority
    player.wallSlide = null
    // Fall through to Y collision, then the grab block is handled next frame (or later in this frame if called again)
  }

  // --- Wall slide detection ---
  // Wall slide when: not grounded, pressing into a wall, and falling (or stationary)
  // Only if NOT grabbing (grab takes priority)
  const pressingLeft = input.left && player.vx <= 0
  const pressingRight = input.right && player.vx >= 0
  if (!player.grounded && !player.grabbing && wallSlideResult) {
    if (wallSlideResult === 'left' && pressingLeft) {
      player.wallSlide = 'left'
    } else if (wallSlideResult === 'right' && pressingRight) {
      player.wallSlide = 'right'
    } else if (wallSlideResult === 'left' || wallSlideResult === 'right') {
      // Still touching wall but not pressing into it — keep slide briefly for coyote-style wall jump
      if (player.wallSlide !== wallSlideResult) {
        player.wallSlide = null
      }
    }
  } else {
    player.wallSlide = null
  }

  // --- Climb indicator ---
  // When wall-sliding, check if the player can climb onto the platform.
  if (player.wallSlide) {
    const wallPlatform = findWallPlatform(player, platforms, player.wallSlide)
    if (wallPlatform && canClimbPlatform(player, wallPlatform)) {
      player.climbIndicator = {
        platformId: wallPlatform.id,
        x: wallPlatform.x,
        y: wallPlatform.y,
        width: wallPlatform.width,
        side: player.wallSlide,
      }
    }
  }

  // --- Ledge grab proximity indicator ---
  // When jumping upward (vy < 0), scan for platforms whose edges the player
  // is approaching from below. Show a wider-range indicator so the player
  // sees it before the collision frame.
  if (player.vy < 0 && !player.ledgeGrabIndicator) {
    const playerCenterX = player.x + player.width / 2
    const proxThreshold = LEDGE_GRAB_THRESHOLD * 2
    for (const platform of platforms) {
      if (platform.passThrough) continue
      // Player must be below the platform (head below platform bottom)
      // and within a reasonable vertical distance
      if (player.y <= platform.y + platform.height) continue
      if (player.y > platform.y + platform.height + 120) continue

      const nearLeftEdge =
        playerCenterX > platform.x && playerCenterX < platform.x + proxThreshold
      const nearRightEdge =
        playerCenterX < platform.x + platform.width &&
        playerCenterX > platform.x + platform.width - proxThreshold

      if (nearLeftEdge || nearRightEdge) {
        player.ledgeGrabIndicator = {
          platformId: platform.id,
          edge: nearLeftEdge ? 'left' : 'right',
          x: platform.x,
          y: platform.y,
          width: platform.width,
          height: platform.height,
        }
        break
      }
    }
  }

  // Move Y
  player.y += player.vy * dtSec
  const groundedBefore = player.grounded
  player.grounded = false
  resolveCollisionAxisY(player, platforms, dtSec, input, phase)

  // --- Coyote time ---
  // If player was grounded this frame, reset the grounded timer
  if (player.grounded && !groundedBefore) {
    player.groundedTimer = 0
  }

  // --- Wall slide speed cap ---
  if (player.wallSlide && player.vy > WALL_SLIDE_SPEED) {
    player.vy = WALL_SLIDE_SPEED
  }

  // --- Buffered jump (grounded or coyote) ---
  if (
    player.jumpBufferTimer > 0 &&
    (player.grounded || player.groundedTimer < COYOTE_TIME_MS)
  ) {
    player.vy = JUMP_VELOCITY
    player.grounded = false
    player.groundedTimer = COYOTE_TIME_MS + 1
    player.jumpBufferTimer = 0
    player.wallSlide = null
  }

  // --- Wall jump / Climb ---
  // Only if grounded jump didn't fire
  if (player.jumpBufferTimer > 0 && player.wallSlide) {
    // Check if we can climb onto the platform instead of wall jumping
    const wallPlatform = findWallPlatform(player, platforms, player.wallSlide)
    if (wallPlatform && canClimbPlatform(player, wallPlatform)) {
      // Platform top is within climbing reach — start smooth climb animation
      player.climbing = true
      player.climbStartY = player.y
      player.climbTargetY = wallPlatform.y - player.height
      player.climbTimer = 0
      player.climbWallPlatformId = wallPlatform.id
      player.wallSlide = null
      player.jumpBufferTimer = 0
      player.vx = 0
      player.vy = 0
      player.grounded = false
    } else {
      // Normal wall jump
      const awayX =
        player.wallSlide === 'right'
          ? -WALL_JUMP_VELOCITY_X
          : WALL_JUMP_VELOCITY_X
      player.vx = awayX
      player.vy = WALL_JUMP_VELOCITY_Y
      player.wallSlide = null
      player.jumpBufferTimer = 0
    }
  }

  // --- Fall death ---
  if (player.y > stage.fallY) {
    events.push({
      type: 'death',
      cause: 'fall',
      checkpointId: player.lastCheckpointId,
    })
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
 * Resolve collisions along the X axis.
 * Pushes the player out of any overlapping platforms.
 * Returns 'left' or 'right' when the player is flush against a wall,
 * or null if no wall contact.
 * Also detects wall-cling when airborne player contacts a grabbable wall.
 */
function resolveCollisionAxis(player, platforms, input, phase) {
  let wallSide = null

  for (const platform of platforms) {
    if (!aabbOverlap(player, platform)) continue

    // Skip passThrough platforms entirely for X collision.
    // Pass-through platforms should only interact on the Y axis
    // (landing on top or passing through). Without this skip,
    // pressing left/right while inside a passThrough platform
    // would teleport the player to the platform's edge.
    if (platform.passThrough) continue

    if (player.vx > 0) {
      // --- Near top edge check ---
      // If player head is near the platform top AND pressing toward,
      // skip X push-out and let Y collision handle edge-hang.
      const nearTopEdge = player.y - platform.y <= GRAB_EDGE_DETECT_THRESHOLD
      const towardOnEdge =
        nearTopEdge &&
        phase === 'racing' &&
        !player.grounded &&
        !input.down &&
        isPlatformGrabbable(platform) &&
        isPressingTowardPlatform(player, platform, input)
      if (towardOnEdge) {
        // Don't push out — let Y collision handle edge-hang
        player.vx = 0
        wallSide = 'right'
        continue
      }

      // --- Wall-cling detection (right wall) ---
      if (
        phase === 'racing' &&
        !player.grounded &&
        !input.down &&
        isPlatformGrabbable(platform)
      ) {
        // Snap to wall and enter wall-cling
        player.x = platform.x - player.width
        player.vx = 0
        player.vy = 0
        player.grabbing = true
        player._justGrabbed = true
        player.grabType = 'wall-cling'
        player.grabPlatformId = platform.id
        player.grabSide = 'right'
        player.grabHangTimer = 0
        player.grabHangDuration =
          platform.hangTimeMs ??
          (isCrumblingPlatform(platform)
            ? GRAB_CRUMBLING_HANG_TIME_MS
            : GRAB_DEFAULT_HANG_TIME_MS)
        player.grabHangPhysics = platform.hangPhysics ?? 'motionless'
        return 'right'
      }

      player.x = platform.x - player.width
      wallSide = 'right'
    } else if (player.vx < 0) {
      // --- Near top edge check ---
      const nearTopEdge = player.y - platform.y <= GRAB_EDGE_DETECT_THRESHOLD
      const towardOnEdge =
        nearTopEdge &&
        phase === 'racing' &&
        !player.grounded &&
        !input.down &&
        isPlatformGrabbable(platform) &&
        isPressingTowardPlatform(player, platform, input)
      if (towardOnEdge) {
        // Don't push out — let Y collision handle edge-hang
        player.vx = 0
        wallSide = 'left'
        continue
      }

      // --- Wall-cling detection (left wall) ---
      if (
        phase === 'racing' &&
        !player.grounded &&
        !input.down &&
        isPlatformGrabbable(platform)
      ) {
        // Snap to wall and enter wall-cling
        player.x = platform.x + platform.width
        player.vx = 0
        player.vy = 0
        player.grabbing = true
        player._justGrabbed = true
        player.grabType = 'wall-cling'
        player.grabPlatformId = platform.id
        player.grabSide = 'left'
        player.grabHangTimer = 0
        player.grabHangDuration =
          platform.hangTimeMs ??
          (isCrumblingPlatform(platform)
            ? GRAB_CRUMBLING_HANG_TIME_MS
            : GRAB_DEFAULT_HANG_TIME_MS)
        player.grabHangPhysics = platform.hangPhysics ?? 'motionless'
        return 'left'
      }

      player.x = platform.x + platform.width
      wallSide = 'left'
    }
    player.vx = 0
  }

  return wallSide
}

function resolveCollisionAxisY(player, platforms, dtSec, input, phase) {
  for (const platform of platforms) {
    if (!aabbOverlap(player, platform)) continue

    if (player.vy > 0) {
      if (platform.passThrough && player.dropThroughId === platform.id) continue

      // --- Edge-hang downward catch ---
      // Player falling + near edge + pressing toward platform center.
      // groundedTimer > 0 prevents catching on the first frame walking off
      // a platform (where gravity creates a 0.5px AABB overlap).
      if (
        phase === 'racing' &&
        !player.grounded &&
        player.groundedTimer > 0 &&
        !player.grabbing &&
        !input.down &&
        isPlatformGrabbable(platform)
      ) {
        const prevFeetY = player.y + player.height - player.vy * dtSec
        if (prevFeetY <= platform.y + GRAB_EDGE_DETECT_THRESHOLD) {
          const playerCenterX = player.x + player.width / 2
          const { nearLeftEdge, nearRightEdge } = isNearPlatformEdge(
            playerCenterX,
            platform,
            GRAB_EDGE_DETECT_THRESHOLD
          )
          if (
            (nearLeftEdge || nearRightEdge) &&
            isPressingTowardPlatform(player, platform, input)
          ) {
            // Edge-hang catch
            player.y = platform.y + 2
            player.vy = 0
            player.grabbing = true
            player._justGrabbed = true
            player.grabType = 'edge-hang'
            player.grabPlatformId = platform.id
            player.grabSide = nearLeftEdge ? 'right' : 'left'
            player.facingRight = nearLeftEdge
            player.grabHangTimer = 0
            player.grabHangDuration =
              platform.hangTimeMs ??
              (isCrumblingPlatform(platform)
                ? GRAB_CRUMBLING_HANG_TIME_MS
                : GRAB_DEFAULT_HANG_TIME_MS)
            player.grabHangPhysics = platform.hangPhysics ?? 'motionless'
            continue
          }
        }
      }

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
      // --- Edge-hang upward detection ---
      // Player jumping up + near edge + pressing toward platform center.
      // groundedTimer > 0 prevents catching on the same frame as a jump
      // from the platform (where the player is still at platform-top height).
      if (
        phase === 'racing' &&
        !player.grounded &&
        player.groundedTimer > 0 &&
        !player.grabbing &&
        !input.down &&
        isPlatformGrabbable(platform)
      ) {
        const prevFeetY = player.y + player.height - player.vy * dtSec
        if (prevFeetY > platform.y) {
          const playerCenterX = player.x + player.width / 2
          const { nearLeftEdge, nearRightEdge } = isNearPlatformEdge(
            playerCenterX,
            platform,
            GRAB_EDGE_DETECT_THRESHOLD
          )
          if (
            (nearLeftEdge || nearRightEdge) &&
            isPressingTowardPlatform(player, platform, input)
          ) {
            // Edge-hang
            player.y = platform.y + 2
            player.vy = 0
            player.grabbing = true
            player._justGrabbed = true
            player.grabType = 'edge-hang'
            player.grabPlatformId = platform.id
            player.grabSide = nearLeftEdge ? 'right' : 'left'
            player.facingRight = nearLeftEdge
            player.grabHangTimer = 0
            player.grabHangDuration =
              platform.hangTimeMs ??
              (isCrumblingPlatform(platform)
                ? GRAB_CRUMBLING_HANG_TIME_MS
                : GRAB_DEFAULT_HANG_TIME_MS)
            player.grabHangPhysics = platform.hangPhysics ?? 'motionless'
            continue
          }
        }
      }

      if (platform.passThrough) continue

      // --- Ledge grab / pull-up ---
      // If the player was below the platform before this frame (jumping up into it)
      // and is near a horizontal edge, snap on top instead of bumping head.
      const prevFeetY = player.y + player.height - player.vy * dtSec
      if (prevFeetY > platform.y) {
        const playerCenterX = player.x + player.width / 2
        const platformLeft = platform.x
        const platformRight = platform.x + platform.width

        const nearLeftEdge =
          playerCenterX > platformLeft &&
          playerCenterX < platformLeft + LEDGE_GRAB_THRESHOLD
        const nearRightEdge =
          playerCenterX < platformRight &&
          playerCenterX > platformRight - LEDGE_GRAB_THRESHOLD

        if (nearLeftEdge || nearRightEdge) {
          // Only set indicator if not already set (first platform wins)
          if (!player.ledgeGrabIndicator) {
            player.ledgeGrabIndicator = {
              platformId: platform.id,
              edge: nearLeftEdge ? 'left' : 'right',
              x: platform.x,
              y: platform.y,
              width: platform.width,
              height: platform.height,
            }
          }
          player.y = platform.y - player.height
          player.vy = 0
          player.grounded = true
          player.standingOnId = platform.id
          continue
        }
      }

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
  const prevOffset = getMovingPlatformOffset(
    platform,
    Math.max(0, stageTimeMs - dt)
  )

  const currX = platform.x + (platform.axis === 'x' ? currOffset : 0)
  const currY = platform.y + (platform.axis === 'y' ? currOffset : 0)
  const prevX = platform.x + (platform.axis === 'x' ? prevOffset : 0)
  const prevY = platform.y + (platform.axis === 'y' ? prevOffset : 0)

  return {
    id: platform.id,
    type: platform.type,
    x: currX,
    y: currY,
    width: platform.width,
    height: platform.height,
    dx: currX - prevX,
    dy: currY - prevY,
    passThrough: platform.passThrough,
    grabbable: platform.grabbable,
    hangTimeMs: platform.hangTimeMs,
    hangPhysics: platform.hangPhysics,
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
export function updateCrumblingTimers(
  crumblingState,
  crumblingPlatforms,
  players,
  dt
) {
  for (const platform of crumblingPlatforms) {
    let state = crumblingState[platform.id]
    if (!state) {
      state = { crumbleTimer: 0, respawnTimer: 0, active: true }
      crumblingState[platform.id] = state
    }

    if (state.active) {
      // Is any player standing on or grabbing this platform?
      // Use proximity to top surface (within 2px) because aabbOverlap
      // returns false when the player's bottom edge equals the platform's top edge.
      const occupied = players.some(
        (p) =>
          (p.grounded &&
            p.x < platform.x + platform.width &&
            p.x + p.width > platform.x &&
            Math.abs(p.y + p.height - platform.y) < 2) ||
          (p.grabbing && p.grabPlatformId === platform.id)
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

/**
 * Find the platform the player is flush against during wall slide.
 * Scans platforms to find one whose horizontal edge aligns with the player's
 * side (within tolerance) and vertically overlaps with the player.
 * @param {object} player
 * @param {Array}  platforms
 * @param {string} wallSlide - 'left' or 'right'
 * @returns {object|null} the wall platform
 */
export function findWallPlatform(player, platforms, wallSlide) {
  const tolerance = 2 // px

  for (const platform of platforms) {
    // Check horizontal alignment based on wall slide direction
    if (wallSlide === 'left') {
      if (Math.abs(player.x - (platform.x + platform.width)) > tolerance)
        continue
    } else if (wallSlide === 'right') {
      if (Math.abs(player.x + player.width - platform.x) > tolerance) continue
    } else {
      continue
    }

    // Check vertical overlap (player must be touching the platform's side)
    if (
      player.y < platform.y + platform.height &&
      player.y + player.height > platform.y
    ) {
      return platform
    }
  }

  return null
}

/**
 * Check if a player can climb onto the wall platform they are sliding against.
 * The platform top must be within CLIMB_HEIGHT above the player's head.
 * @param {object} player
 * @param {object} wallPlatform
 * @returns {boolean}
 */
export function canClimbPlatform(player, wallPlatform) {
  return player.y - wallPlatform.y < CLIMB_HEIGHT
}
