import { createLoopControls } from './engine/GameLoop.js'
import { createPlayer } from './entities/Player.js'
import { stages } from './levels/index.js'

let runIdCounter = 0
function nextRunId() {
  return `run-${++runIdCounter}`
}

/** Module-level singleton state */
let state = null

function initState() {
  return {
    phase: 'idle', // idle | countdown | racing | stageComplete | gameOver
    currentStageIndex: 0,
    stageResults: [],
    runId: null,
    renderers: {},
    loopControls: createLoopControls(),
    raceTimeMs: 0,
    countdownEndsAtMs: 0,
    stageCompleteUntilMs: 0,
    player1: null,
    player2: null,
    stageStartedAtMs: null,
    dnfCountdown: null,
  }
}

/**
 * Create a fresh stage result for the given stage id.
 */
export function createStageResult(stageId) {
  return {
    stageId,
    players: {
      p1: {
        finished: false,
        dnf: false,
        finishTimeMs: null,
        penaltyMs: 0,
        deaths: 0,
        checkpointsTouched: [],
      },
      p2: {
        finished: false,
        dnf: false,
        finishTimeMs: null,
        penaltyMs: 0,
        deaths: 0,
        checkpointsTouched: [],
      },
    },
    dnfCountdown: null,
    completed: false,
  }
}

/**
 * Record a player finishing the stage.
 * finishedMap: { p1?: boolean, p2?: boolean }
 * Returns a new stage result with updated finish data.
 */
export function recordStageFinish(stageResult, finishedMap, finishTimeMs) {
  const result = JSON.parse(JSON.stringify(stageResult))

  let anyP1 = false
  let anyP2 = false

  if (finishedMap.p1) {
    result.players.p1.finished = true
    result.players.p1.finishTimeMs = finishTimeMs
    anyP1 = true
  }
  if (finishedMap.p2) {
    result.players.p2.finished = true
    result.players.p2.finishTimeMs = finishTimeMs
    anyP2 = true
  }

  // Check if both finished in same tick
  const bothFinished = result.players.p1.finished && result.players.p2.finished

  if (bothFinished) {
    result.completed = true
    result.dnfCountdown = null
  } else if (anyP1 || anyP2) {
    // One player finished - start DNF countdown for the other
    const unfinishedPlayer = result.players.p1.finished ? 'p2' : 'p1'
    result.dnfCountdown = {
      playerId: unfinishedPlayer,
      startedAtMs: finishTimeMs,
      expiresAtMs: finishTimeMs + 15000,
    }
  }

  return result
}

/**
 * Check if the DNF timer has expired at the given current time.
 * Returns a new stage result with dnf set if expired.
 */
export function expireDnf(stageResult, currentTimeMs) {
  if (!stageResult.dnfCountdown) return stageResult

  const result = JSON.parse(JSON.stringify(stageResult))

  if (currentTimeMs >= result.dnfCountdown.expiresAtMs) {
    const dnfPlayer = result.dnfCountdown.playerId
    result.players[dnfPlayer].dnf = true
    result.completed = true
  }

  return result
}

/**
 * Add a 3000ms death penalty to a player, tracking the checkpoint they respawned at.
 */
export function addDeathPenalty(stageResult, playerId, checkpointId) {
  const result = JSON.parse(JSON.stringify(stageResult))
  result.players[playerId].penaltyMs += 3000
  result.players[playerId].deaths += 1
  if (checkpointId && !result.players[playerId].checkpointsTouched.includes(checkpointId)) {
    result.players[playerId].checkpointsTouched.push(checkpointId)
  }
  return result
}

/**
 * Calculate a player's displayed stage time.
 * For finished players: finishTimeMs + penaltyMs
 * For DNF players: expiresAtMs + penaltyMs
 */
export function calculatePlayerStageTime(stageResult, playerId) {
  const player = stageResult.players[playerId]
  if (player.dnf && stageResult.dnfCountdown) {
    return stageResult.dnfCountdown.expiresAtMs + player.penaltyMs
  }
  if (player.finishTimeMs !== null) {
    return player.finishTimeMs + player.penaltyMs
  }
  return 0
}

/**
 * Calculate final results from all stage results.
 * Returns { totals: { p1: number, p2: number }, winner: 'p1' | 'p2' | 'tie' }
 */
export function calculateFinalResult(stageResults) {
  const totals = { p1: 0, p2: 0 }

  for (const result of stageResults) {
    totals.p1 += calculatePlayerStageTime(result, 'p1')
    totals.p2 += calculatePlayerStageTime(result, 'p2')
  }

  let winner
  if (totals.p1 < totals.p2) {
    winner = 'p1'
  } else if (totals.p2 < totals.p1) {
    winner = 'p2'
  } else {
    winner = 'tie'
  }

  return { totals, winner }
}

/**
 * Reset the run with player configuration, entering countdown phase.
 */
export function resetRun({ player1, player2, stage }) {
  state = initState()
  state.runId = nextRunId()
  state.player1 = createPlayer('p1', stage?.spawnPoints?.p1 || { x: 700, y: 3440 })
  state.player1.name = player1?.name || 'Player 1'
  state.player1.avatarKey = player1?.avatarKey || 'joy'
  state.player2 = createPlayer('p2', stage?.spawnPoints?.p2 || { x: 760, y: 3440 })
  state.player2.name = player2?.name || 'Player 2'
  state.player2.avatarKey = player2?.avatarKey || 'anger'
  state.phase = 'countdown'
  state.countdownEndsAtMs = 3000
  state.stageResults = []
  state.currentStageIndex = 0
}

/**
 * Advance the state machine by one fixed timestep.
 * @param {number} dt - Delta time in ms
 * @param {{ p1?: boolean, p2?: boolean }} [finishMap] - Which players reached the finish zone this tick
 */
export function tick(dt, finishMap) {
  if (!state) return

  switch (state.phase) {
    case 'countdown':
      state.countdownEndsAtMs -= dt
      if (state.countdownEndsAtMs <= 0) {
        state.phase = 'racing'
        state.countdownEndsAtMs = 0
        state.raceTimeMs = 0
        state.stageStartedAtMs = 0
      }
      break

    case 'racing': {
      state.raceTimeMs += dt

      // Check DNF expiry on current stage result
      const currentResult = state.stageResults[state.currentStageIndex]
      if (currentResult && currentResult.dnfCountdown && !currentResult.completed) {
        const updated = expireDnf(currentResult, state.raceTimeMs)
        state.stageResults[state.currentStageIndex] = updated
        if (updated.completed) {
          state.phase = 'stageComplete'
          state.stageCompleteUntilMs = state.raceTimeMs + 3000
          break
        }
      }

      // Check finish zone
      if (finishMap && (finishMap.p1 || finishMap.p2)) {
        handleFinish(finishMap)
      }
      break
    }

    case 'stageComplete':
      state.raceTimeMs += dt
      if (state.raceTimeMs >= state.stageCompleteUntilMs) {
        advanceToNextStage()
      }
      break

    case 'gameOver':
      // No automatic transitions from gameOver
      break
  }
}

function handleFinish(finishMap) {
  const stageId = `stage-${state.currentStageIndex + 1}`
  const existing = state.stageResults[state.currentStageIndex]
  const result = existing || createStageResult(stageId)

  const updated = recordStageFinish(result, finishMap, state.raceTimeMs)
  state.stageResults[state.currentStageIndex] = updated

  if (updated.completed) {
    state.phase = 'stageComplete'
    state.stageCompleteUntilMs = state.raceTimeMs + 3000
  }
}

function advanceToNextStage() {
  state.currentStageIndex++
  if (state.currentStageIndex >= 3) {
    state.phase = 'gameOver'
  } else {
    state.phase = 'countdown'
    state.countdownEndsAtMs = 3000
    state.raceTimeMs = 0
    respawnPlayersAtSpawn()
  }
}

function respawnPlayersAtSpawn() {
  const stage = stages[state.currentStageIndex] || stages[0]
  if (state.player1 && stage.spawnPoints.p1) {
    state.player1.x = stage.spawnPoints.p1.x
    state.player1.y = stage.spawnPoints.p1.y
    state.player1.vx = 0
    state.player1.vy = 0
    state.player1.grounded = false
    state.player1.finished = false
    state.player1.lastCheckpointId = null
    state.player1.invulnerabilityTimer = 0
  }
  if (state.player2 && stage.spawnPoints.p2) {
    state.player2.x = stage.spawnPoints.p2.x
    state.player2.y = stage.spawnPoints.p2.y
    state.player2.vx = 0
    state.player2.vy = 0
    state.player2.grounded = false
    state.player2.finished = false
    state.player2.lastCheckpointId = null
    state.player2.invulnerabilityTimer = 0
  }
}

/**
 * Restart the run from stage 1, preserving player config.
 */
export function restartRun() {
  if (!state) return
  state.phase = 'countdown'
  state.currentStageIndex = 0
  state.stageResults = []
  state.raceTimeMs = 0
  state.countdownEndsAtMs = 3000
  state.stageCompleteUntilMs = 0
  state.stageStartedAtMs = null
  state.dnfCountdown = null
  if (state.player1) {
    const spawn = state.player1._spawnPoint || { x: 700, y: 3440 }
    Object.assign(state.player1, createPlayer('p1', spawn))
    state.player1.name = state.player1.name || 'Player 1'
  }
  if (state.player2) {
    const spawn = state.player2._spawnPoint || { x: 760, y: 3440 }
    Object.assign(state.player2, createPlayer('p2', spawn))
    state.player2.name = state.player2.name || 'Player 2'
  }
}

/**
 * Attach a renderer panel.
 * Does not reset an active run if other renderers remain attached.
 */
export function attachRenderer({ panelSlot, playerId, canvas }) {
  if (!state) {
    state = initState()
  }

  state.renderers[panelSlot] = { playerId, canvas }

  // Transition from idle to countdown if we have a run
  if (state.phase === 'idle' && state.runId) {
    state.phase = 'countdown'
    state.countdownEndsAtMs = 3000
  }
}

/**
 * Detach a renderer panel.
 */
export function detachRenderer(panelSlot) {
  if (!state) return
  delete state.renderers[panelSlot]
}

/**
 * Get a snapshot of the current state (for tests and UI).
 */
export function getSnapshot() {
  if (!state) {
    state = initState()
  }

  const rendererCount = Object.keys(state.renderers).length

  return {
    phase: state.phase,
    currentStageIndex: state.currentStageIndex,
    stageResults: state.stageResults,
    runId: state.runId,
    rendererCount,
    renderers: state.renderers,
    raceTimeMs: state.raceTimeMs,
    countdownEndsAtMs: state.countdownEndsAtMs,
    loopControls: state.loopControls,
    player1: state.player1,
    player2: state.player2,
  }
}

/**
 * Full disposal: cancel loop, clear all state, reset to idle.
 */
export function dispose() {
  if (!state) return
  state.loopControls.stop({
    cancelAnimationFrame: (id) => {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(id)
      }
    },
  })
  state = initState()
}
