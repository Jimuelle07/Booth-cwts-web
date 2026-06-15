export function drawBackground(ctx, camera, viewW, viewH, theme) {
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

  const skyGrad = ctx.createLinearGradient(camera.x, camera.y, camera.x, camera.y + viewH)
  skyGrad.addColorStop(0, t.skyTop)
  skyGrad.addColorStop(1, t.skyBottom)
  ctx.fillStyle = skyGrad
  ctx.fillRect(camera.x, camera.y, viewW, viewH)

  drawMountainLayer(ctx, camera, viewW, viewH, t.mountainFar, 0.1, 0.4, 120)
  drawMountainLayer(ctx, camera, viewW, viewH, t.mountainMid, 0.2, 0.55, 80)

  ctx.fillStyle = t.ground
  ctx.fillRect(camera.x, camera.y + viewH - 30, viewW, 30)
}

function drawMountainLayer(ctx, camera, viewW, viewH, color, parallax, heightFactor, baseY) {
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
