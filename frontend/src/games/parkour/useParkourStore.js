import { create } from 'zustand'

// ─── match config ─────────────────────────────────────────────────────────────
// A race-to-the-top platformer. Each stage is one race: the first player to climb
// above the finish line wins that stage. Win STAGES_TO_WIN of the 3 stages and you
// take the match. Both panels share this store so a result on either side resolves
// the match for both.
export const STAGE_COUNT = 3
export const STAGES_TO_WIN = 2 // first to win 2 of 3 stages wins the match
export const STAGE_BANNER_MS = 2200 // how long the "tops Stage N" banner lingers
export const MATCH_SECONDS = 120 // 2 minute game timer
export const COUNTDOWN_MS = 5000 // 5 seconds before the clock starts

const INIT_WINS = { player1: 0, player2: 0 }

const useParkourStore = create((set, get) => ({
  refCount: 0, // mounted canvases (left + right)
  round: 0, // bumped on restart so each canvas resets its local player

  stageIndex: 0, // 0..STAGE_COUNT-1 — which stage is live
  stageWins: { ...INIT_WINS }, // stages won per player
  stageWinner: null, // 'player1' | 'player2' — who topped the live stage (drives the banner)
  stageEndsAt: 0, // ms timestamp when the banner clears and the next stage begins
  winner: null, // 'player1' | 'player2' | 'tie' | 'nobody' — set once someone reaches STAGES_TO_WIN
  startTime: 0,
  timeLeft: MATCH_SECONDS,

  mount: () => set((s) => ({ refCount: s.refCount + 1 })),

  unmount: () => {
    const { refCount } = get()
    if (refCount <= 1) {
      set({
        refCount: 0,
        round: 0,
        stageIndex: 0,
        stageWins: { ...INIT_WINS },
        stageWinner: null,
        stageEndsAt: 0,
        winner: null,
        startTime: 0,
        timeLeft: MATCH_SECONDS,
      })
    } else {
      set((s) => ({ refCount: s.refCount - 1 }))
    }
  },

  init: () => {
    if (get().startTime === 0) {
      set({ startTime: Date.now() + COUNTDOWN_MS })
    }
  },

  tickClock: () => {
    const s = get()
    if (s.startTime === 0 || s.winner || Date.now() < s.startTime) return

    const remainMs = s.startTime + MATCH_SECONDS * 1000 - Date.now()
    const secs = Math.max(0, Math.ceil(remainMs / 1000))
    if (secs !== s.timeLeft) set({ timeLeft: secs })

    if (remainMs <= 0) {
      set({
        winner: 'nobody',
        timeLeft: 0,
      })
    }
  },

  // First player to crest the finish line tops the stage. Idempotent and
  // order-safe: once a stage has a winner, later reports (the runner-up, or a
  // duplicate from the same panel) are ignored. Reaching STAGES_TO_WIN ends the match.
  reportStageTop: (playerKey) => {
    const s = get()
    if (s.winner || s.stageWinner) return

    const wins = s.stageWins[playerKey] + 1
    const stageWins = { ...s.stageWins, [playerKey]: wins }

    set({
      stageWinner: playerKey,
      stageWins,
      stageEndsAt: Date.now() + STAGE_BANNER_MS,
      winner: wins >= STAGES_TO_WIN ? playerKey : null,
    })
  },

  // Move on to the next stage after the banner. Idempotent and safe to call from
  // both canvases every frame — it only advances once the banner timer is up and
  // there's a stage left to play. No-op once the match has a winner.
  advanceStageIfReady: () => {
    const s = get()
    if (s.winner || !s.stageWinner) return
    if (Date.now() < s.stageEndsAt) return

    set({
      stageIndex: Math.min(s.stageIndex + 1, STAGE_COUNT - 1),
      stageWinner: null,
      stageEndsAt: 0,
    })
  },

  restart: () =>
    set((s) => ({
      round: s.round + 1,
      stageIndex: 0,
      stageWins: { ...INIT_WINS },
      stageWinner: null,
      stageEndsAt: 0,
      winner: null,
      startTime: Date.now() + COUNTDOWN_MS,
      timeLeft: MATCH_SECONDS,
    })),
}))

export default useParkourStore
