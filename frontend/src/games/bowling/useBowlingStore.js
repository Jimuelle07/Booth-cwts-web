import { create } from 'zustand'

// Number of frames each player bowls before the match is scored.
// Kept short (5) for a punchy split-screen match; standard bowling is 10.
export const FRAMES = 5
export const PINS = 10

const INIT_PLAYER = {
  frames: [],        // [{ rolls: number[] }]  one entry per frame played
  currentFrame: 0,
  rollInFrame: 0,    // 0 = first ball of the frame, 1 = second ball
  finished: false,
  total: 0,
  lastRoll: null,    // { knocked, isStrike, isSpare } — for HUD flair
}

// Standard 10-pin scoring (strike = 10 + next two balls, spare = 10 + next ball)
// computed over a flat list of rolls. Missing bonus balls count as 0, so the
// last frame does not award fill balls — an accepted arcade simplification.
function computeTotal(frames) {
  const rolls = []
  for (const f of frames) for (const r of f.rolls) rolls.push(r)

  let total = 0
  let j = 0
  for (let frame = 0; frame < frames.length; frame++) {
    if (rolls[j] === 10) {
      total += 10 + (rolls[j + 1] || 0) + (rolls[j + 2] || 0)
      j += 1
    } else if ((rolls[j] || 0) + (rolls[j + 1] || 0) === 10) {
      total += 10 + (rolls[j + 2] || 0)
      j += 2
    } else {
      total += (rolls[j] || 0) + (rolls[j + 1] || 0)
      j += 2
    }
  }
  return total
}

const useBowlingStore = create((set, get) => ({
  refCount: 0,
  round: 0, // bumped on restart so each canvas re-initialises its local lane
  winner: null, // 'player1' | 'player2' | 'tie' | null
  player1: { ...INIT_PLAYER },
  player2: { ...INIT_PLAYER },

  mount: () => set((s) => ({ refCount: s.refCount + 1 })),

  unmount: () => {
    const { refCount } = get()
    if (refCount <= 1) {
      set({
        refCount: 0,
        round: 0,
        winner: null,
        player1: { ...INIT_PLAYER },
        player2: { ...INIT_PLAYER },
      })
    } else {
      set((s) => ({ refCount: s.refCount - 1 }))
    }
  },

  // Wipe both players and start a fresh match (triggered from the win overlay).
  restartGame: () =>
    set((s) => ({
      round: s.round + 1,
      winner: null,
      player1: { ...INIT_PLAYER },
      player2: { ...INIT_PLAYER },
    })),

  // Record the number of pins a player knocked down on a single ball, advance
  // the frame/roll cursor, recompute the running score, and resolve the winner
  // once both players have completed all their frames.
  submitRoll: (playerKey, knocked) => {
    const s = get()
    if (s.winner) return
    const p = s[playerKey]
    if (p.finished) return

    const frames = p.frames.map((f) => ({ rolls: [...f.rolls] }))
    if (!frames[p.currentFrame]) frames[p.currentFrame] = { rolls: [] }
    frames[p.currentFrame].rolls.push(knocked)

    const sum = frames[p.currentFrame].rolls.reduce((a, b) => a + b, 0)
    const isStrike = p.rollInFrame === 0 && knocked === 10
    const isSpare = p.rollInFrame === 1 && sum === 10

    const frameComplete = isStrike || p.rollInFrame === 1
    let currentFrame = p.currentFrame
    let rollInFrame = 1
    let finished = false

    if (frameComplete) {
      // Frame is over — strike ends it after one ball, otherwise after two.
      currentFrame = p.currentFrame + 1
      rollInFrame = 0
      if (currentFrame >= FRAMES) {
        finished = true
        currentFrame = FRAMES
      }
    }

    const newPlayer = {
      ...p,
      frames,
      currentFrame,
      rollInFrame,
      finished,
      total: computeTotal(frames),
      lastRoll: { knocked, isStrike, isSpare },
    }

    const next = { [playerKey]: newPlayer }

    const otherKey = playerKey === 'player1' ? 'player2' : 'player1'
    const other = s[otherKey]
    if (finished && other.finished) {
      next.winner =
        newPlayer.total > other.total
          ? playerKey
          : newPlayer.total < other.total
            ? otherKey
            : 'tie'
    }

    set(next)
  },
}))

export default useBowlingStore
