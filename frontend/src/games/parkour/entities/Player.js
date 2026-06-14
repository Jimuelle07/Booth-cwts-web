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
  }
}

export function respawnAtCheckpoint(player, checkpoints) {
  player.deaths++
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
  player.x = spawnPoint.x
  player.y = spawnPoint.y
  player.vx = 0
  player.vy = 0
  player.grounded = false
  player.alive = true
  player.invulnerabilityTimer = 1000
}
