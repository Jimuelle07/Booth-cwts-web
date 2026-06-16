// Shared "cancel / quit current game" control.
//
// Rendered once, centered at the bottom of the split-screen game view. Pressing
// it abandons the in-progress match and returns to character select to start a
// brand-new game.

import useGameStore from '../store/useGameStore'

export default function CancelGameButton() {
  const setPhase = useGameStore((s) => s.setPhase)

  return (
    <button
      type="button"
      onClick={() => setPhase('CHARACTER_SELECT')}
      aria-label="Cancel the current game and return to character select"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2 rounded-full
                 bg-black/55 hover:bg-black/75 text-white/85 hover:text-white
                 border border-white/20 backdrop-blur-sm shadow-lg
                 text-xs font-bold uppercase tracking-widest transition-colors"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <span className="material-symbols-outlined text-base" aria-hidden="true">
        close
      </span>
      Cancel Game
    </button>
  )
}