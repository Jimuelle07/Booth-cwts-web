import { useEffect, useState } from 'react'
import LineDivider from './components/landing_page/LineDivider'
import MenuScreen from './components/landing_page/MenuScreen'
import CharacterSelect from './components/landing_page/CharacterSelect'
import GameSelect from './components/landing_page/GameSelect'
import CancelGameButton from './components/CancelGameButton'
import registry from './games/registry'
import useGameStore from './store/useGameStore'

// Module-level Set: one keyboard, one source of truth, stable reference across renders
const pressedKeys = new Set()

function GamePanel({ side, canvasId, player1, player2 }) {
  const { selectedGame } = useGameStore()
  const ActiveGame = registry.find((g) => g.id === selectedGame)?.component ?? null

  return (
    <div className="flex flex-col w-[50vw] h-screen bg-indigo-50">

      <div className="flex-1 relative overflow-hidden">
        {ActiveGame ? (
          <ActiveGame
            key={selectedGame}
            canvasId={canvasId}
            player1={player1}
            player2={player2}
            pressedKeys={pressedKeys}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-indigo-300 font-medium text-sm">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-50">videogame_asset_off</span>
            Game "{selectedGame}" is not fully implemented yet in registry.
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const { player1, player2, currentPhase } = useGameStore()

  useEffect(() => {
    const onKeyDown = (e) => {
      pressedKeys.add(e.key)
      pressedKeys.add(e.code)
    }
    const onKeyUp = (e) => {
      pressedKeys.delete(e.key)
      pressedKeys.delete(e.code)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  if (currentPhase === 'LANDING_PAGE') return <MenuScreen />
  if (currentPhase === 'CHARACTER_SELECT') return <CharacterSelect />
  if (currentPhase === 'GAME_SELECT') return <GameSelect />

  return (
    <div className="flex flex-row w-screen h-screen overflow-hidden">
      <GamePanel
        side="Player 1"
        canvasId="canvas-left"
        player1={player1}
        player2={player2}
      />
      <LineDivider />
      <GamePanel
        side="Player 2"
        canvasId="canvas-right"
        player1={player1}
        player2={player2}
      />
      <CancelGameButton />
    </div>
  )
}
