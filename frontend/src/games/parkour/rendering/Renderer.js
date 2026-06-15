export function createRenderer(canvas, camera, playerId, stage) {
  return {
    canvas,
    ctx: canvas.getContext('2d'),
    camera,
    playerId,
    stage,
    initialized: true,
  }
}

export function renderFrame(renderer, players, stage, particleSystem) {
  const { ctx, canvas, camera } = renderer
  const dpr = window.devicePixelRatio || 1
  const w = canvas.width / dpr
  const h = canvas.height / dpr

  ctx.clearRect(0, 0, w, h)

  ctx.save()

  const shakeX = camera.shakeX || 0
  const shakeY = camera.shakeY || 0
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY)

  const now = performance.now()

  drawBackground(ctx, camera, w, h, stage.background.theme)
  drawPlatforms(ctx, stage.platforms, camera, w, h)
  drawMovingPlatforms(
    ctx,
    stage.movingPlatforms,
    camera,
    w,
    h,
    stage._raceTimeMs || 0
  )
  drawCheckpoints(ctx, stage.checkpoints, camera, w, h)
  drawHazards(ctx, stage.hazards, camera, w, h)
  drawFinishZone(ctx, stage.finishZone, camera, w, h)
  drawGrabIndicators(ctx, players, camera, w, h, now)
  drawClimbIndicators(ctx, players, camera, w, h, now)
  drawPlayers(ctx, players, camera, w, h)

  if (particleSystem) {
    drawParticles(ctx, camera, particleSystem)
  }

  ctx.restore()
}

function drawBackground(ctx, camera, viewW, viewH, theme) {
  const themes = {
    greenfield: {
      skyTop: '#87CEEB',
      skyBottom: '#b8e6b8',
      mountainFar: '#5a8a6a',
      mountainMid: '#4a7a5a',
      ground: '#3a6a4a',
    },
    midnight: {
      skyTop: '#0a0a23',
      skyBottom: '#1a1a3e',
      mountainFar: '#15152d',
      mountainMid: '#1a1a35',
      ground: '#12122a',
    },
    summit: {
      skyTop: '#b0c4de',
      skyBottom: '#8faabe',
      mountainFar: '#6a8aab',
      mountainMid: '#5a7a9a',
      ground: '#4a6a8a',
    },
  }

  const t = themes[theme] || themes.greenfield

  const skyGrad = ctx.createLinearGradient(
    camera.x,
    camera.y,
    camera.x,
    camera.y + viewH
  )
  skyGrad.addColorStop(0, t.skyTop)
  skyGrad.addColorStop(1, t.skyBottom)
  ctx.fillStyle = skyGrad
  ctx.fillRect(camera.x, camera.y, viewW, viewH)

  const parallaxFar = 0.1
  const parallaxMid = 0.2

  drawMountainLayer(
    ctx,
    camera,
    viewW,
    viewH,
    t.mountainFar,
    parallaxFar,
    0.4,
    120
  )
  drawMountainLayer(
    ctx,
    camera,
    viewW,
    viewH,
    t.mountainMid,
    parallaxMid,
    0.55,
    80
  )

  ctx.fillStyle = t.ground
  ctx.fillRect(camera.x, camera.y + viewH - 30, viewW, 30)
}

function drawMountainLayer(
  ctx,
  camera,
  viewW,
  viewH,
  color,
  parallax,
  heightFactor,
  baseY
) {
  const offsetX = camera.x * parallax

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(camera.x, camera.y + viewH)

  const segW = 200
  const startSeg = Math.floor(offsetX / segW) - 1
  const endSeg = Math.ceil((offsetX + viewW) / segW) + 1

  for (let i = startSeg; i <= endSeg; i++) {
    const sx = i * segW - offsetX
    const peakH = baseY + Math.sin(i * 0.7) * 30 + Math.cos(i * 1.3) * 20
    ctx.lineTo(sx + segW / 2, camera.y + viewH - peakH * heightFactor)
    ctx.lineTo(sx + segW, camera.y + viewH - baseY * 0.6)
  }

  ctx.lineTo(camera.x + viewW, camera.y + viewH)
  ctx.closePath()
  ctx.fill()
}

function drawPlatforms(ctx, platforms, camera, viewW, viewH) {
  for (const platform of platforms) {
    if (!isOnScreen(platform, camera, viewW, viewH)) continue

    if (platform.type === 'crumbling') {
      drawCrumblingPlatform(ctx, platform)
    } else if (platform.width > 800) {
      drawGroundPlatform(ctx, platform)
    } else if (platform.height > 100) {
      drawWallPlatform(ctx, platform)
    } else {
      drawLedgePlatform(ctx, platform)
    }
  }
}

function drawGroundPlatform(ctx, p) {
  const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height)
  grad.addColorStop(0, '#5a7a4a')
  grad.addColorStop(0.3, '#4a6a3a')
  grad.addColorStop(1, '#3a5a2a')
  ctx.fillStyle = grad
  ctx.fillRect(p.x, p.y, p.width, p.height)

  ctx.fillStyle = '#6a8a5a'
  for (let x = p.x; x < p.x + p.width; x += 40) {
    ctx.fillRect(x, p.y, 2, 4)
  }
}

function drawWallPlatform(ctx, p) {
  const grad = ctx.createLinearGradient(p.x, p.y, p.x + p.width, p.y)
  grad.addColorStop(0, '#4a3a2a')
  grad.addColorStop(0.5, '#5a4a3a')
  grad.addColorStop(1, '#4a3a2a')
  ctx.fillStyle = grad
  ctx.fillRect(p.x, p.y, p.width, p.height)

  ctx.strokeStyle = '#3a2a1a'
  ctx.lineWidth = 1
  ctx.strokeRect(p.x, p.y, p.width, p.height)
}

function drawLedgePlatform(ctx, p) {
  const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height)
  grad.addColorStop(0, '#6a8a5a')
  grad.addColorStop(1, '#4a6a3a')
  ctx.fillStyle = grad
  ctx.fillRect(p.x, p.y, p.width, p.height)

  ctx.fillStyle = '#7a9a6a'
  ctx.fillRect(p.x, p.y, p.width, 3)

  ctx.strokeStyle = '#3a5a2a'
  ctx.lineWidth = 1
  ctx.strokeRect(p.x, p.y, p.width, p.height)
}

function drawCrumblingPlatform(ctx, p) {
  ctx.fillStyle = '#8a7a5a'
  ctx.fillRect(p.x, p.y, p.width, p.height)

  ctx.strokeStyle = '#6a5a3a'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])
  ctx.strokeRect(p.x, p.y, p.width, p.height)
  ctx.setLineDash([])

  ctx.fillStyle = '#9a8a6a'
  for (let i = 0; i < 3; i++) {
    const cx = p.x + p.width * (0.2 + i * 0.3)
    ctx.fillRect(cx - 2, p.y + 2, 4, p.height - 4)
  }
}

function drawMovingPlatforms(
  ctx,
  movingPlatforms,
  camera,
  viewW,
  viewH,
  raceTimeMs
) {
  for (const mp of movingPlatforms) {
    const offset =
      Math.sin(
        (((raceTimeMs / 1000) * mp.speed) / (mp.distance || 1)) * Math.PI * 2 +
          mp.phase
      ) *
      (mp.distance / 2)
    const mx = mp.x + (mp.axis === 'x' ? offset : 0)
    const my = mp.y + (mp.axis === 'y' ? offset : 0)
    const moved = { x: mx, y: my, width: mp.width, height: mp.height }

    if (!isOnScreen(moved, camera, viewW, viewH)) continue

    const grad = ctx.createLinearGradient(mx, my, mx, my + mp.height)
    grad.addColorStop(0, '#7a6a8a')
    grad.addColorStop(1, '#5a4a6a')
    ctx.fillStyle = grad
    ctx.fillRect(mx, my, mp.width, mp.height)

    ctx.fillStyle = '#9a8aaa'
    ctx.fillRect(mx, my, mp.width, 3)

    ctx.strokeStyle = '#4a3a5a'
    ctx.lineWidth = 1
    ctx.strokeRect(mx, my, mp.width, mp.height)

    ctx.fillStyle = '#6a5a7a'
    ctx.fillRect(mx + mp.width / 2 - 4, my + mp.height / 2 - 2, 8, 4)
  }
}

function drawCheckpoints(ctx, checkpoints, camera, viewW, viewH) {
  for (const cp of checkpoints) {
    if (!isOnScreen(cp, camera, viewW, viewH)) continue

    ctx.fillStyle = '#f1c40f'
    ctx.globalAlpha = 0.15
    ctx.fillRect(cp.x, cp.y, cp.width, cp.height)
    ctx.globalAlpha = 1.0

    ctx.strokeStyle = '#f39c12'
    ctx.lineWidth = 2
    ctx.strokeRect(cp.x, cp.y, cp.width, cp.height)

    const flagX = cp.x + cp.width / 2
    const flagY = cp.y - 20
    ctx.strokeStyle = '#f39c12'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(flagX, flagY + 20)
    ctx.lineTo(flagX, flagY)
    ctx.stroke()

    ctx.fillStyle = '#f1c40f'
    ctx.beginPath()
    ctx.moveTo(flagX, flagY)
    ctx.lineTo(flagX + 14, flagY + 6)
    ctx.lineTo(flagX, flagY + 12)
    ctx.closePath()
    ctx.fill()
  }
}

function drawHazards(ctx, hazards, camera, viewW, viewH) {
  for (const hazard of hazards) {
    if (!isOnScreen(hazard, camera, viewW, viewH)) continue

    ctx.fillStyle = '#c0392b'
    ctx.fillRect(hazard.x, hazard.y, hazard.width, hazard.height)

    ctx.fillStyle = '#e74c3c'
    const spikeW = 16
    for (let x = hazard.x; x < hazard.x + hazard.width - spikeW; x += spikeW) {
      ctx.beginPath()
      ctx.moveTo(x, hazard.y + hazard.height)
      ctx.lineTo(x + spikeW / 2, hazard.y)
      ctx.lineTo(x + spikeW, hazard.y + hazard.height)
      ctx.closePath()
      ctx.fill()
    }

    ctx.strokeStyle = '#922b21'
    ctx.lineWidth = 1
    ctx.strokeRect(hazard.x, hazard.y, hazard.width, hazard.height)
  }
}

function drawFinishZone(ctx, finishZone, camera, viewW, viewH) {
  if (!isOnScreen(finishZone, camera, viewW, viewH)) return

  const fz = finishZone

  ctx.fillStyle = '#2ecc71'
  ctx.globalAlpha = 0.1
  ctx.fillRect(fz.x, fz.y, fz.width, fz.height)
  ctx.globalAlpha = 1.0

  ctx.strokeStyle = '#27ae60'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 4])
  ctx.strokeRect(fz.x, fz.y, fz.width, fz.height)
  ctx.setLineDash([])

  const flagX = fz.x + fz.width / 2
  const flagY = fz.y + 10

  ctx.strokeStyle = '#ecf0f1'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(flagX, flagY + 50)
  ctx.lineTo(flagX, flagY)
  ctx.stroke()

  ctx.fillStyle = '#2ecc71'
  ctx.beginPath()
  ctx.moveTo(flagX, flagY)
  ctx.lineTo(flagX + 24, flagY + 10)
  ctx.lineTo(flagX, flagY + 20)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#27ae60'
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('EXIT', flagX, fz.y + fz.height - 8)
}

function drawPlayers(ctx, players, camera, viewW, viewH) {
  for (const player of players) {
    if (!isOnScreen(player, camera, viewW, viewH)) continue

    const isP1 = player.id === 'p1'
    const bodyColor = isP1 ? '#3498db' : '#e74c3c'
    const brightColor = isP1 ? '#5dade2' : '#f1948a'
    const darkColor = isP1 ? '#2980b9' : '#c0392b'

    if (
      player.invulnerabilityTimer > 0 &&
      Math.floor(player.invulnerabilityTimer / 100) % 2 === 0
    ) {
      ctx.globalAlpha = 0.4
    }

    // --- Grab low-time pulse warning ---
    let effectiveBodyColor = bodyColor
    if (
      player.grabbing &&
      player.grabHangDuration > 0 &&
      player.grabHangTimer > player.grabHangDuration - 1000
    ) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.02) // ~300ms cycle
      // Interpolate between normal and bright
      effectiveBodyColor = isP1 ? '#3498db' : '#e74c3c'
      if (pulse > 0.5) {
        effectiveBodyColor = brightColor
      }
    }

    ctx.fillStyle = darkColor
    ctx.fillRect(player.x + 2, player.y + 2, player.width, player.height)

    ctx.fillStyle = effectiveBodyColor
    ctx.fillRect(player.x, player.y, player.width, player.height)

    // --- Arm rectangles during grab ---
    if (player.grabbing) {
      if (player.grabType === 'edge-hang') {
        // Arms extend upward from shoulders, gripping the platform edge
        const armW = 6
        const armH = 10
        ctx.fillStyle = effectiveBodyColor
        // Left arm
        ctx.fillRect(player.x + 4, player.y - armH, armW, armH)
        // Right arm
        ctx.fillRect(player.x + player.width - 10, player.y - armH, armW, armH)
      } else if (player.grabType === 'wall-cling') {
        // Arms extend sideways toward the wall
        const armW = 4
        const armH = 6
        ctx.fillStyle = effectiveBodyColor
        if (player.grabSide === 'right') {
          // Wall on right, arms extend right
          ctx.fillRect(player.x + player.width, player.y + 12, armW, armH)
          ctx.fillRect(player.x + player.width, player.y + 22, armW, armH)
        } else {
          // Wall on left, arms extend left
          ctx.fillRect(player.x - armW, player.y + 12, armW, armH)
          ctx.fillRect(player.x - armW, player.y + 22, armW, armH)
        }
      } else if (player.grabType === 'underside-hang' && player._grabPlatformHeight != null) {
        // Arms extend upward from shoulders through the platform, with hand hooks at top
        const armH = player._grabPlatformHeight + 8
        const armW = 4
        const handW = 6
        const handH = 2
        const armTopY = player.y - player._grabPlatformHeight - 6

        ctx.fillStyle = effectiveBodyColor

        // Left arm
        ctx.fillRect(player.x + 4, armTopY, armW, armH)
        // Right arm
        ctx.fillRect(player.x + player.width - 8, armTopY, armW, armH)

        // Left hand hook
        ctx.fillRect(player.x + 3, armTopY, handW, handH)
        // Right hand hook
        ctx.fillRect(player.x + player.width - 9, armTopY, handW, handH)
      }
    }

    ctx.fillStyle = '#ffffff'
    const eyeY = player.y + 10
    const eyeSize = 4
    if (player.facingRight) {
      ctx.fillRect(player.x + player.width - 10, eyeY, eyeSize, eyeSize)
      ctx.fillRect(player.x + player.width - 18, eyeY, eyeSize, eyeSize)
    } else {
      ctx.fillRect(player.x + 6, eyeY, eyeSize, eyeSize)
      ctx.fillRect(player.x + 14, eyeY, eyeSize, eyeSize)
    }

    ctx.fillStyle = '#2c3e50'
    const pupilSize = 2
    // During edge-hang or underside-hang, pupils shift upward (looking toward climb target)
    const pupilOffsetY = player.grabType === 'edge-hang' || player.grabType === 'underside-hang' ? -1 : 1
    if (player.facingRight) {
      ctx.fillRect(
        player.x + player.width - 9,
        eyeY + pupilOffsetY,
        pupilSize,
        pupilSize
      )
      ctx.fillRect(
        player.x + player.width - 17,
        eyeY + pupilOffsetY,
        pupilSize,
        pupilSize
      )
    } else {
      ctx.fillRect(player.x + 7, eyeY + pupilOffsetY, pupilSize, pupilSize)
      ctx.fillRect(player.x + 15, eyeY + pupilOffsetY, pupilSize, pupilSize)
    }

    ctx.globalAlpha = 1.0

    // --- Timer indicator bar ---
    if (player.grabbing && player.grabHangDuration > 0) {
      const barW = 20
      const barH = 4
      const barX = player.x + player.width / 2 - barW / 2
      const isUndersideHang = player.grabType === 'underside-hang'
      const barY = isUndersideHang
        ? player.y + player.height + 6   // below feet (underside-hang)
        : player.y - 14                   // above head (edge-hang, wall-cling)

      const remaining = Math.max(
        0,
        player.grabHangDuration - player.grabHangTimer
      )
      const ratio = remaining / player.grabHangDuration

      // Color: green (>66%) → yellow (33-66%) → red (<33%)
      let timerColor = '#2ecc71' // green
      if (ratio < 0.33) {
        timerColor = '#e74c3c' // red
      } else if (ratio < 0.66) {
        timerColor = '#f1c40f' // yellow
      }

      // Background bar
      ctx.fillStyle = '#333333'
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2)

      // Foreground bar
      ctx.fillStyle = timerColor
      ctx.fillRect(barX, barY, barW * ratio, barH)
    }
  }
}

/**
 * Draw ledge-grab indicators on platform edges the player can grab.
 * Shows a pulsing highlight on the vertical edge near the top.
 */
function drawGrabIndicators(ctx, players, camera, viewW, viewH, now) {
  for (const player of players) {
    if (!player || !player.ledgeGrabIndicator) continue
    const ind = player.ledgeGrabIndicator
    const indicatorX = ind.edge === 'left' ? ind.x : ind.x + ind.width

    if (
      !isOnScreen(
        { x: indicatorX, y: ind.y, width: 4, height: ind.height },
        camera,
        viewW,
        viewH
      )
    )
      continue

    // Pulsing glow — bright bar on the grabbable edge
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006)
    ctx.fillStyle = '#ffd700'
    ctx.globalAlpha = 0.6 + 0.4 * pulse

    const edgeX = ind.edge === 'left' ? ind.x - 3 : ind.x + ind.width
    const barWidth = 3
    const barHeight = Math.min(28, ind.height)
    const barY = ind.y

    ctx.fillRect(edgeX, barY, barWidth, barHeight)

    // Bright edge line (inner highlight)
    ctx.fillStyle = '#fff8c4'
    ctx.globalAlpha = 0.5 + 0.5 * pulse
    ctx.fillRect(edgeX, barY, 1, barHeight)

    ctx.globalAlpha = 1
  }
}

/**
 * Draw climb indicators on platform top edges the player can climb onto.
 * Shows a pulsing highlight along the top surface.
 */
function drawClimbIndicators(ctx, players, camera, viewW, viewH, now) {
  for (const player of players) {
    if (!player || !player.climbIndicator) continue
    const ind = player.climbIndicator

    if (
      !isOnScreen(
        { x: ind.x, y: ind.y, width: ind.width, height: 6 },
        camera,
        viewW,
        viewH
      )
    )
      continue

    // Pulsing glow
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.005 + 1)
    ctx.globalAlpha = 0.5 + 0.5 * pulse

    // Draw bright line along the top edge
    ctx.fillStyle = '#00e5ff'
    ctx.fillRect(ind.x, ind.y - 3, ind.width, 3)

    // Second highlight line
    ctx.fillStyle = '#80f0ff'
    ctx.globalAlpha = 0.3 + 0.3 * pulse
    ctx.fillRect(ind.x, ind.y - 5, ind.width, 2)

    ctx.globalAlpha = 1
  }
}

function drawParticles(ctx, camera, particleSystem) {
  for (const p of particleSystem.particles) {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#e74c3c'
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1
}

function isOnScreen(entity, camera, viewW, viewH) {
  return (
    entity.x + entity.width > camera.x &&
    entity.x < camera.x + viewW &&
    entity.y + entity.height > camera.y &&
    entity.y < camera.y + viewH
  )
}
