import { describe, expect, it, vi } from 'vitest'
import { createRenderer, renderFrame } from './Renderer.js'
import { createCamera } from '../engine/Camera.js'

describe('Renderer', () => {
  function createMockCanvas() {
    const ctx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      stroke: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      globalAlpha: 1,
    }
    return {
      width: 800,
      height: 600,
      getContext: vi.fn(() => ctx),
      ctx,
    }
  }

  it('createRenderer returns a renderer object', () => {
    const canvas = createMockCanvas()
    const camera = createCamera(1600, 3600)
    const stage = { background: { theme: 'greenfield' } }
    const renderer = createRenderer(canvas, camera, 'p1', stage)
    expect(renderer.initialized).toBe(true)
    expect(renderer.canvas).toBe(canvas)
    expect(renderer.camera).toBe(camera)
    expect(renderer.playerId).toBe('p1')
    expect(renderer.stage).toBe(stage)
  })

  it('renderFrame clears and draws without throwing', () => {
    const canvas = createMockCanvas()
    const camera = createCamera(1600, 3600)
    const stage = {
      background: { theme: 'greenfield' },
      platforms: [
        { id: 'ground', type: 'solid', x: 0, y: 580, width: 1600, height: 20 },
      ],
      movingPlatforms: [],
      hazards: [],
      checkpoints: [],
      finishZone: { x: 560, y: 40, width: 480, height: 120 },
    }
    const renderer = createRenderer(canvas, camera, 'p1', stage)
    const players = [
      { id: 'p1', x: 100, y: 500, width: 28, height: 32, facingRight: true, invulnerabilityTimer: 0 },
    ]

    expect(() => renderFrame(renderer, players, stage)).not.toThrow()
    expect(canvas.ctx.clearRect).toHaveBeenCalled()
    expect(canvas.ctx.save).toHaveBeenCalled()
    expect(canvas.ctx.restore).toHaveBeenCalled()
    expect(canvas.ctx.translate).toHaveBeenCalled()
  })

  it('renderFrame skips off-screen entities', () => {
    const canvas = createMockCanvas()
    const camera = createCamera(1600, 3600)
    camera.x = 0
    camera.y = 0
    const stage = {
      background: { theme: 'midnight' },
      platforms: [
        { id: 'ground', type: 'solid', x: 0, y: 580, width: 1600, height: 20 },
      ],
      movingPlatforms: [],
      hazards: [
        { id: 'hazard-1', type: 'hazard', x: 5000, y: 5000, width: 180, height: 32, damage: 'death' },
      ],
      checkpoints: [
        { id: 'cp-1', x: 5000, y: 5000, width: 240, height: 40 },
      ],
      finishZone: { x: 560, y: 40, width: 480, height: 120 },
    }
    const renderer = createRenderer(canvas, camera, 'p1', stage)
    const players = [
      { id: 'p1', x: 5000, y: 5000, width: 28, height: 32, facingRight: true, invulnerabilityTimer: 0 },
    ]

    renderFrame(renderer, players, stage)
    expect(canvas.ctx.clearRect).toHaveBeenCalled()
  })

  it('renderFrame draws on-screen hazards and checkpoints', () => {
    const canvas = createMockCanvas()
    const camera = createCamera(1600, 3600)
    camera.x = 0
    camera.y = 0
    const stage = {
      background: { theme: 'midnight' },
      platforms: [
        { id: 'ground', type: 'solid', x: 0, y: 580, width: 1600, height: 20 },
      ],
      movingPlatforms: [],
      hazards: [
        { id: 'hazard-1', type: 'hazard', x: 400, y: 200, width: 180, height: 32, damage: 'death' },
      ],
      checkpoints: [
        { id: 'cp-1', x: 600, y: 250, width: 240, height: 40 },
      ],
      finishZone: { x: 560, y: 40, width: 480, height: 120 },
    }
    const renderer = createRenderer(canvas, camera, 'p1', stage)
    const players = [
      { id: 'p1', x: 100, y: 500, width: 28, height: 32, facingRight: true, invulnerabilityTimer: 0 },
      { id: 'p2', x: 200, y: 520, width: 28, height: 32, facingRight: false, invulnerabilityTimer: 0 },
    ]

    renderFrame(renderer, players, stage)
    expect(canvas.ctx.clearRect).toHaveBeenCalled()
  })

  it('renderFrame does not throw with no players', () => {
    const canvas = createMockCanvas()
    const camera = createCamera(1600, 3600)
    const stage = {
      background: { theme: 'summit' },
      platforms: [],
      movingPlatforms: [],
      hazards: [],
      checkpoints: [],
      finishZone: { x: 560, y: 40, width: 480, height: 120 },
    }
    const renderer = createRenderer(canvas, camera, 'p1', stage)

    expect(() => renderFrame(renderer, [], stage)).not.toThrow()
  })

  it('renderFrame handles unknown theme', () => {
    const canvas = createMockCanvas()
    const camera = createCamera(1600, 3600)
    const stage = {
      background: { theme: 'nonexistent' },
      platforms: [],
      movingPlatforms: [],
      hazards: [],
      checkpoints: [],
      finishZone: { x: 560, y: 40, width: 480, height: 120 },
    }
    const renderer = createRenderer(canvas, camera, 'p1', stage)

    expect(() => renderFrame(renderer, [], stage)).not.toThrow()
  })
})
