import stage1 from './stage1.js'
import stage2 from './stage2.js'
import stage3 from './stage3.js'

export const stages = [stage1, stage2, stage3]

const REQUIRED_KEYS = [
  'id',
  'name',
  'width',
  'height',
  'fallY',
  'spawnPoints',
  'checkpoints',
  'finishZone',
  'platforms',
  'movingPlatforms',
  'hazards',
  'background',
]

export function validateStage(stage) {
  const errors = []

  if (!stage || typeof stage !== 'object') {
    return ['stage is not an object']
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in stage)) {
      errors.push(`missing required key: ${key}`)
    }
  }

  if (stage.spawnPoints) {
    if (!stage.spawnPoints.p1 || typeof stage.spawnPoints.p1.x !== 'number') {
      errors.push('spawnPoints.p1 missing or invalid')
    }
    if (!stage.spawnPoints.p2 || typeof stage.spawnPoints.p2.x !== 'number') {
      errors.push('spawnPoints.p2 missing or invalid')
    }
  }

  if (stage.finishZone) {
    if (typeof stage.finishZone.x !== 'number' || typeof stage.finishZone.y !== 'number') {
      errors.push('finishZone missing or invalid')
    }
  }

  if (!Array.isArray(stage.platforms)) {
    errors.push('platforms must be an array')
  }

  if (!Array.isArray(stage.movingPlatforms)) {
    errors.push('movingPlatforms must be an array')
  }

  if (!Array.isArray(stage.hazards)) {
    errors.push('hazards must be an array')
  }

  if (!Array.isArray(stage.checkpoints)) {
    errors.push('checkpoints must be an array')
  }

  return errors
}
