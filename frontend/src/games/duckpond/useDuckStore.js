import { create } from 'zustand'

// ─── match config ─────────────────────────────────────────────────────────────
export const MATCH_SECONDS = 60 // 1-minute duck hunt
export const COUNTDOWN_MS = 3000 // "3·2·1·GO" before the clock starts

// Each player hunts in their own pond (separate split-screen panels). The store
// only coordinates the shared clock and resolves the winner by score when time
// runs out — exactly like the tug-of-war store it replaces.

const INIT_PLAYER = {
  score: 0, // total points from ducks shot
  hits: 0, // ducks shot
  shots: 0, // total trigger pulls (hits + misses) — drives accuracy
  best: 0, // highest single-duck value bagged
}

const useDuckStore = create((set, get) => ({
  refCount: 0,
  round: 0, // bumped on restart so each canvas wipes its local pond
  winner: null, // 'player1' | 'player2' | 'tie' | null
  startTime: 0, // ms timestamp when the clock starts (after the countdown)
  timeLeft: MATCH_SECONDS, // whole seconds remaining — reactive, drives the HUD clock
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
        startTime: 0,
        timeLeft: MATCH_SECONDS,
        player1: { ...INIT_PLAYER },
        player2: { ...INIT_PLAYER },
      })
    } else {
      set((s) => ({ refCount: s.refCount - 1 }))
    }
  },

  // First canvas to mount arms the shared clock; the second one no-ops.
  init: () => {
    if (get().startTime === 0) {
      set({ startTime: Date.now() + COUNTDOWN_MS })
    }
  },

  restart: () =>
    set((s) => ({
      round: s.round + 1,
      winner: null,
      startTime: Date.now() + COUNTDOWN_MS,
      timeLeft: MATCH_SECONDS,
      player1: { ...INIT_PLAYER },
      player2: { ...INIT_PLAYER },
    })),

  // A duck was shot: bank the points and bump the hit stats.
  registerHit: (playerKey, points) => {
    const s = get()
    if (s.winner) return
    const p = s[playerKey]
    set({
      [playerKey]: {
        ...p,
        score: p.score + points,
        hits: p.hits + 1,
        shots: p.shots + 1,
        best: Math.max(p.best, points),
      },
    })
  },

  // A trigger pull that hit nothing — only the shot count moves (for accuracy).
  registerMiss: (playerKey) => {
    const s = get()
    if (s.winner) return
    const p = s[playerKey]
    set({ [playerKey]: { ...p, shots: p.shots + 1 } })
  },

  // Advance the shared clock. Idempotent and safe to call from both canvases
  // every frame — it only writes when the whole-second value changes and
  // resolves the winner once, by score, when time runs out.
  tickClock: () => {
    const s = get()
    if (s.startTime === 0 || s.winner) return

    const remainMs = s.startTime + MATCH_SECONDS * 1000 - Date.now()
    const secs = Math.max(0, Math.ceil(remainMs / 1000))
    if (secs !== s.timeLeft) set({ timeLeft: secs })

    if (remainMs <= 0) {
      const a = s.player1.score
      const b = s.player2.score
      set({
        winner: a > b ? 'player1' : b > a ? 'player2' : 'tie',
        timeLeft: 0,
      })
    }
  },
}))

export default useDuckStore
