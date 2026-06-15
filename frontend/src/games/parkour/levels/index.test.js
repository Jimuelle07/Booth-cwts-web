import { describe, expect, it } from 'vitest'
import { stages, validateStage } from './index'
import stage1 from './stage1.js'
import stage2 from './stage2.js'
import stage3 from './stage3.js'

describe('validateStage', () => {
  it('returns error for non-object', () => {
    const errors = validateStage(null)
    expect(errors).toContain('stage is not an object')
  })

  it('returns error for undefined', () => {
    const errors = validateStage(undefined)
    expect(errors).toContain('stage is not an object')
  })

  it('returns errors for empty object', () => {
    const errors = validateStage({})
    expect(errors.length).toBeGreaterThan(0)
    expect(errors).toContain('missing required key: id')
    expect(errors).toContain('missing required key: name')
    expect(errors).toContain('platforms must be an array')
    expect(errors).toContain('movingPlatforms must be an array')
    expect(errors).toContain('hazards must be an array')
    expect(errors).toContain('checkpoints must be an array')
  })
})

describe('Parkour levels', () => {
  it('exports three valid stages with upward progress geometry', () => {
    expect(stages).toHaveLength(3)

    for (const stage of stages) {
      expect(validateStage(stage)).toEqual([])
      expect(stage.spawnPoints.p1.y).toBeGreaterThan(stage.finishZone.y)
      expect(stage.spawnPoints.p2.y).toBeGreaterThan(stage.finishZone.y)
      expect(stage.fallY).toBeGreaterThanOrEqual(stage.height)
    }
  })
})

describe('Stage geometry validation', () => {
  it('stage1 has valid geometry', () => {
    const verticalGaps = []
    for (let i = 1; i < stage1.platforms.filter(p => p.type === 'solid' && p.y < stage1.spawnPoints.p1.y).length; i++) {
      const solidPlats = stage1.platforms.filter(p => p.type === 'solid' && p.y < stage1.spawnPoints.p1.y)
      const gap = solidPlats[i - 1].y - (solidPlats[i].y + solidPlats[i].height)
      if (gap > 0) verticalGaps.push(gap)
    }
    // All vertical gaps should be reachable (< 107px max jump height)
    for (const gap of verticalGaps) {
      expect(gap).toBeLessThan(107)
    }
  })

  it('stage3 has crumbling platforms with required properties', () => {
    const crumbling = stage3.platforms.filter(p => p.type === 'crumbling')
    expect(crumbling.length).toBeGreaterThan(0)
    for (const p of crumbling) {
      expect(p.crumbleAfterMs).toBeGreaterThan(0)
      expect(p.respawnAfterMs).toBeGreaterThan(0)
    }
  })

  it('stage2 has moving platforms with required properties', () => {
    const moving = stage2.movingPlatforms
    expect(moving.length).toBeGreaterThan(0)
    for (const p of moving) {
      expect(p.axis).toMatch(/^x|y$/)
      expect(p.distance).toBeGreaterThan(0)
      expect(p.speed).toBeGreaterThan(0)
    }
  })

  it('all stages have hazards within bounds', () => {
    for (const stage of [stage1, stage2, stage3]) {
      for (const hazard of stage.hazards) {
        expect(hazard.x + hazard.width).toBeLessThanOrEqual(stage.width)
        expect(hazard.y + hazard.height).toBeLessThanOrEqual(stage.height)
      }
    }
  })

  it('all stages have checkpoints ordered from bottom to top', () => {
    for (const stage of [stage1, stage2, stage3]) {
      for (let i = 1; i < stage.checkpoints.length; i++) {
        expect(stage.checkpoints[i].y).toBeLessThan(stage.checkpoints[i - 1].y)
      }
    }
  })
})
