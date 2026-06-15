export function createCamera(levelWidth, levelHeight) {
  return {
    x: 0,
    y: 0,
    shakeX: 0,
    shakeY: 0,
    shakeIntensity: 0,
    shakeDecay: 0.9,
    lerpFactor: 0.08,
    levelWidth,
    levelHeight,
  }
}

export function followCamera(camera, targetX, targetY, canvasWidth, canvasHeight) {
  camera.x += (targetX - canvasWidth / 2 - camera.x) * camera.lerpFactor
  camera.y += (targetY - canvasHeight / 2 - camera.y) * camera.lerpFactor

  // Clamp to level bounds
  camera.x = Math.max(0, Math.min(camera.x, camera.levelWidth - canvasWidth))
  camera.y = Math.max(0, Math.min(camera.y, camera.levelHeight - canvasHeight))

  // Decay screen shake
  if (camera.shakeIntensity > 0) {
    camera.shakeX = (Math.random() - 0.5) * 2 * camera.shakeIntensity
    camera.shakeY = (Math.random() - 0.5) * 2 * camera.shakeIntensity
    camera.shakeIntensity *= camera.shakeDecay
    if (camera.shakeIntensity < 0.5) {
      camera.shakeIntensity = 0
      camera.shakeX = 0
      camera.shakeY = 0
    }
  }
}

export function triggerShake(camera, intensity) {
  camera.shakeIntensity = intensity
}
