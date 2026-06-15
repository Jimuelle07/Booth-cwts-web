export function drawOverlay(ctx, canvas, gameState, playerId, stageIndex) {
  const { phase, raceTimeMs, countdownEndsAtMs, stageResults } = gameState
  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr
  const h = canvas.height / dpr

  ctx.save()

  drawHUD(ctx, w, h, gameState, playerId, stageIndex)

  if (phase === 'countdown' && countdownEndsAtMs > 0) {
    drawCountdown(ctx, w, h, countdownEndsAtMs)
  }

  if (phase === 'racing') {
    drawTimer(ctx, w, h, raceTimeMs)
    drawDNFWarning(ctx, w, h, stageResults, stageIndex, raceTimeMs)
  }

  if (phase === 'stageComplete') {
    drawStageResults(ctx, w, h, stageResults, stageIndex)
  }

  if (phase === 'gameOver') {
    drawGameOver(ctx, w, h, stageResults)
  }

  ctx.restore()
}

function drawHUD(ctx, w, h, gameState, playerId, stageIndex) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.fillRect(0, 0, w, 40)

  ctx.fillStyle = '#ecf0f1'
  ctx.font = 'bold 13px monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(`Stage ${stageIndex + 1}`, 12, 20)

  const playerLabel = playerId === 'p1' ? 'P1' : 'P2'
  const playerColor = playerId === 'p1' ? '#3498db' : '#e74c3c'
  ctx.textAlign = 'right'
  ctx.fillStyle = playerColor
  ctx.fillText(playerLabel, w - 12, 20)

  drawProgressBar(ctx, w, h, gameState, playerId, stageIndex)
}

function drawProgressBar(ctx, w, h, gameState, playerId, stageIndex) {
  const barH = 6
  const barY = h - barH - 4
  const stages = gameState._stages || 3

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.fillRect(0, barY, w, barH)

  for (let i = 0; i < stages; i++) {
    const segW = w / stages
    const segX = i * segW

    ctx.fillStyle = i < stageIndex ? 'rgba(46, 204, 113, 0.6)' : 'rgba(255, 255, 255, 0.1)'
    ctx.fillRect(segX, barY, segW - 1, barH)
  }

  const currentResult = gameState.stageResults && gameState.stageResults[stageIndex]
  if (currentResult) {
    for (const pid of ['p1', 'p2']) {
      const playerResult = currentResult.players[pid]
      if (!playerResult) continue

      const color = pid === 'p1' ? '#3498db' : '#e74c3c'
      const dotX = 12 + (pid === 'p2' ? 10 : 0)
      const progress = playerResult.finished ? 1 : 0.5
      const dotY = barY + barH / 2

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(dotX + progress * 20, dotY, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawCountdown(ctx, w, h, countdownEndsAtMs) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.fillRect(0, 0, w, h)

  const remaining = Math.ceil(countdownEndsAtMs / 1000)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(remaining), w / 2, h / 2 - 10)

  ctx.font = 'bold 16px monospace'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.fillText('GET READY', w / 2, h / 2 + 40)
}

function drawTimer(ctx, w, h, raceTimeMs) {
  const seconds = (raceTimeMs / 1000).toFixed(1)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
  ctx.fillRect(w / 2 - 50, 46, 100, 28)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${seconds}s`, w / 2, 60)
}

function drawDNFWarning(ctx, w, h, stageResults, stageIndex, raceTimeMs) {
  if (!stageResults || !stageResults[stageIndex]) return
  const result = stageResults[stageIndex]
  if (!result.dnfCountdown || result.completed) return

  const remaining = Math.max(0, result.dnfCountdown.expiresAtMs - raceTimeMs)
  if (remaining <= 0) return

  const secs = Math.ceil(remaining / 1000)
  const dnfPlayer = result.dnfCountdown.playerId

  ctx.fillStyle = 'rgba(192, 57, 43, 0.7)'
  ctx.fillRect(w / 2 - 100, h / 2 + 60, 200, 36)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${dnfPlayer.toUpperCase()} DNF: ${secs}s`, w / 2, h / 2 + 78)
}

function drawStageResults(ctx, w, h, stageResults, stageIndex) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 20px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('STAGE COMPLETE', w / 2, h / 2 - 60)

  if (stageResults && stageResults[stageIndex]) {
    const result = stageResults[stageIndex]
    const p1Time = result.players.p1.finished
      ? (result.players.p1.finishTimeMs / 1000).toFixed(1) + 's'
      : result.players.p1.dnf ? 'DNF' : '—'
    const p2Time = result.players.p2.finished
      ? (result.players.p2.finishTimeMs / 1000).toFixed(1) + 's'
      : result.players.p2.dnf ? 'DNF' : '—'

    ctx.font = '14px monospace'
    ctx.fillStyle = '#3498db'
    ctx.fillText(`P1: ${p1Time}`, w / 2, h / 2 - 10)
    ctx.fillStyle = '#e74c3c'
    ctx.fillText(`P2: ${p2Time}`, w / 2, h / 2 + 15)
  }

  ctx.font = '12px monospace'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillText('Next stage starting...', w / 2, h / 2 + 50)
}

function drawGameOver(ctx, w, h, stageResults) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(0, 0, w, h)

  const { calculateFinalResult } = getCalculateFinalResult()
  if (!calculateFinalResult || !stageResults || stageResults.length === 0) return

  const { totals, winner } = calculateFinalResult(stageResults)

  ctx.fillStyle = '#f1c40f'
  ctx.font = 'bold 24px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('RACE COMPLETE', w / 2, h / 2 - 80)

  ctx.font = 'bold 18px monospace'
  if (winner === 'tie') {
    ctx.fillStyle = '#f39c12'
    ctx.fillText('TIE!', w / 2, h / 2 - 40)
  } else {
    ctx.fillStyle = winner === 'p1' ? '#3498db' : '#e74c3c'
    ctx.fillText(`${winner.toUpperCase()} WINS!`, w / 2, h / 2 - 40)
  }

  ctx.font = '14px monospace'
  ctx.fillStyle = '#3498db'
  ctx.fillText(`P1 Total: ${(totals.p1 / 1000).toFixed(1)}s`, w / 2, h / 2)
  ctx.fillStyle = '#e74c3c'
  ctx.fillText(`P2 Total: ${(totals.p2 / 1000).toFixed(1)}s`, w / 2, h / 2 + 25)

  ctx.font = '12px monospace'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillText('Use buttons below to restart or exit', w / 2, h / 2 + 60)
}

let _calculateFinalResult = null
export function setCalculateFinalResult(fn) {
  _calculateFinalResult = fn
}
function getCalculateFinalResult() {
  return { calculateFinalResult: _calculateFinalResult }
}
