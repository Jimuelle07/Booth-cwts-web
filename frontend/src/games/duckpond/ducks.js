import mallardImg from './assets/mallard.svg'
import pintailImg from './assets/pintail.svg'
import goldenImg from './assets/golden.svg'

// Duck type table for the Duck Pond shooting game.
//
// Each type tunes how a duck looks, moves, and scores. Smaller / faster ducks
// are rarer and worth more — the classic shooting-gallery risk/reward. All
// values are positive (no penalty ducks).

export const DUCK_TYPES = [
  {
    id: 'mallard',
    label: 'Mallard',
    imageSrc: mallardImg,
    points: 10,
    body: '#6b8e23', // olive-green back
    belly: '#caa46a', // tan underside
    head: '#1f6f50', // classic mallard green head
    sizeMult: 1.18, // big, easy target
    baseSpeed: 0.16, // pond-widths per second at swim
    spawnWeight: 56,
  },
  {
    id: 'pintail',
    label: 'Pintail',
    imageSrc: pintailImg,
    points: 25,
    body: '#cfd6dd',
    belly: '#f2f4f7',
    head: '#8b6b4a',
    sizeMult: 0.92,
    baseSpeed: 0.26,
    spawnWeight: 31,
  },
  {
    id: 'golden',
    label: 'Golden',
    imageSrc: goldenImg,
    points: 50,
    body: '#f7c948',
    belly: '#ffe89c',
    head: '#e0a000',
    sizeMult: 0.72, // small, hard to hit
    baseSpeed: 0.4,
    spawnWeight: 13,
    glow: true, // shimmers so players notice the jackpot
  },
]

const TOTAL_WEIGHT = DUCK_TYPES.reduce((sum, t) => sum + t.spawnWeight, 0)

// Weighted random pick — favours common ducks, occasionally yields a golden.
export function pickDuckType() {
  let roll = Math.random() * TOTAL_WEIGHT
  for (const type of DUCK_TYPES) {
    roll -= type.spawnWeight
    if (roll <= 0) return type
  }
  return DUCK_TYPES[0]
}
