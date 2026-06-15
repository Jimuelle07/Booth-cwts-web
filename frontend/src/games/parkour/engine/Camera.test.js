import { describe, expect, it } from 'vitest'
import { createCamera, followCamera, triggerShake } from './Camera.js'

describe('Camera', () => {
  it('creates a camera with level bounds', () => {
    const cam = createCamera(1600, 3600)
    expect(cam.x).toBe(0)
    expect(cam.y).toBe(0)
    expect(cam.levelWidth).toBe(1600)
    expect(cam.levelHeight).toBe(3600)
  })

  it('followCamera clamps to level bounds', () => {
    const cam = createCamera(1600, 3600)
    // Target far outside bounds
    followCamera(cam, 9999, 9999, 200, 300)
    expect(cam.x).toBeLessThanOrEqual(1600 - 200)
    expect(cam.y).toBeLessThanOrEqual(3600 - 300)
    expect(cam.x).toBeGreaterThanOrEqual(0)
    expect(cam.y).toBeGreaterThanOrEqual(0)
  })

  it('triggerShake sets shake intensity', () => {
    const cam = createCamera(1600, 3600)
    triggerShake(cam, 10)
    expect(cam.shakeIntensity).toBe(10)
  })

  it('followCamera decays shake intensity over time', () => {
    const cam = createCamera(1600, 3600)
    triggerShake(cam, 8)
    followCamera(cam, 400, 300, 800, 600)
    // Shake should be non-zero and decaying
    expect(cam.shakeIntensity).toBeGreaterThan(0)
    expect(cam.shakeIntensity).toBeLessThanOrEqual(8)
    const firstIntensity = cam.shakeIntensity

    followCamera(cam, 400, 300, 800, 600)
    // Shake should have decayed
    expect(cam.shakeIntensity).toBeLessThan(firstIntensity)
  })

  it('followCamera decays shake to zero when below 0.5 threshold', () => {
    const cam = createCamera(1600, 3600)
    triggerShake(cam, 0.6)
    // After a few callbacks, shake should decay below 0.5 and snap to 0
    for (let i = 0; i < 5; i++) {
      followCamera(cam, 400, 300, 800, 600)
    }
    expect(cam.shakeIntensity).toBe(0)
    expect(cam.shakeX).toBe(0)
    expect(cam.shakeY).toBe(0)
  })
})
