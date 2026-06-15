import { create } from 'zustand'

const INIT_PLAYER = { mapIndex: 0, won: false, orbsCollected: 0 }

const useMazeStore = create((set, get) => ({
  refCount: 0,
  initialized: false,
  selectedMapIndices: [],
  player1: { ...INIT_PLAYER },
  player2: { ...INIT_PLAYER },
  winner: null,

  mount: () => set((s) => ({ refCount: s.refCount + 1 })),

  unmount: () => {
    const { refCount } = get()
    if (refCount <= 1) {
      set({
        refCount: 0,
        initialized: false,
        selectedMapIndices: [],
        player1: { ...INIT_PLAYER },
        player2: { ...INIT_PLAYER },
        winner: null,
      })
    } else {
      set((s) => ({ refCount: s.refCount - 1 }))
    }
  },

  initGame: () => {
    if (get().initialized) return
    const indices = [0, 1, 2]
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    set({ initialized: true, selectedMapIndices: indices })
  },

  // Called each time a player collects the next orb in sequence.
  // Advances to the next map automatically once all 3 are collected.
  collectOrb: (playerKey) => {
    const state = get()
    if (state.winner) return
    const player = state[playerKey]
    const newOrbCount = player.orbsCollected + 1
    if (newOrbCount < 3) {
      set({ [playerKey]: { ...player, orbsCollected: newOrbCount } })
    } else {
      const nextMapIdx = player.mapIndex + 1
      if (nextMapIdx >= 3) {
        set({ [playerKey]: { mapIndex: 3, won: true, orbsCollected: 0 }, winner: playerKey })
      } else {
        set({ [playerKey]: { mapIndex: nextMapIdx, orbsCollected: 0, won: false } })
      }
    }
  },
}))

export default useMazeStore
