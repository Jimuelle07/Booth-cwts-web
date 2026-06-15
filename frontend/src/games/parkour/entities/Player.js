export function createPlayer(playerId, spawnPoint) {
  return {
    id: playerId,
    x: spawnPoint.x,
    y: spawnPoint.y,
    width: 28,
    height: 40,
    vx: 0,
    vy: 0,
    grounded: false,
    groundedTimer: 0,
    jumpBufferTimer: 0,
    facingRight: true,
    alive: true,
    invulnerabilityTimer: 0,
    lastCheckpointId: null,
    lastCheckpointX: spawnPoint.x,
    lastCheckpointY: spawnPoint.y,
    deaths: 0,
    finished: false,
    dropThroughId: null,
    standingOnId: null,
    wallSlide: null,
    // Climb animation state
    climbing: false,
    climbStartY: 0,
    climbTargetY: 0,
    climbTimer: 0,
    climbDuration: 160,
    climbWallPlatformId: null,
    // Visual indicators (set by physics, read by renderer)
    ledgeGrabIndicator: null, // { platformId, edge: 'left'|'right', x, y, width } or null
    climbIndicator: null, // { platformId, x, y, width, side: 'left'|'right' } or null
    // Grab/climb state
    grabbing: false, // true when in edge-hang or wall-cling
    grabType: null, // 'edge-hang' | 'wall-cling' | null
    grabPlatformId: null, // id of the platform being grabbed
    grabHangTimer: 0, // ms elapsed in current grab
    grabHangDuration: 5000, // ms until auto-release (from platform config; 5000 default, 3000 for crumbling)
    grabHangPhysics: 'motionless', // 'motionless' | 'slow-slide'
    grabSide: null, // 'left' | 'right' — which side of the player contacts the platform
    _justGrabbed: false, // flag set during collision when entering grab state
    _grabPlatformHeight: null, // stored platform height for underside-hang arm rendering
  }
}

export function respawnAtCheckpoint(player, checkpoints) {
  player.deaths++
  player.climbing = false
  clearGrabState(player)
  if (player.lastCheckpointId) {
    const cp = checkpoints.find((c) => c.id === player.lastCheckpointId)
    if (cp) {
      player.x = cp.x + cp.width / 2 - player.width / 2
      player.y = cp.y - player.height - 2
    }
  }
  player.vx = 0
  player.vy = 0
  player.grounded = false
  player.alive = true
  player.invulnerabilityTimer = 1000
}

export function respawnAtSpawn(player, spawnPoint) {
  player.climbing = false
  clearGrabState(player)
  player.x = spawnPoint.x
  player.y = spawnPoint.y
  player.vx = 0
  player.vy = 0
  player.grounded = false
  player.alive = true
  player.invulnerabilityTimer = 1000
}

function clearGrabState(player) {
  player.grabbing = false
  player.grabType = null
  player.grabPlatformId = null
  player.grabHangTimer = 0
  player.grabHangDuration = 5000
  player.grabHangPhysics = 'motionless'
  player.grabSide = null
  player._grabPlatformHeight = null
}
