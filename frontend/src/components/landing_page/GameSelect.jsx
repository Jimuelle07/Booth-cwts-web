import useGameStore from '../../store/useGameStore'
import { CHARACTERS } from './CharacterSelect'
import AnimatedBackground from './AnimatedBackground'

const GAMES = [
  { id: 'parkour', name: 'Parkour', icon: 'directions_run', color: '#27AE60' },
  { id: 'shooting', name: 'Shooting', icon: 'my_location', color: '#E03B1F' },
  { id: 'maze', name: 'Maze', icon: 'grid_view', color: '#6366f1' },
  { id: 'bowling', name: 'Bowling', icon: 'adjust', color: '#D2691E' },
]

export default function GameSelect() {
  const { player1, player2, setGame, setPhase } = useGameStore()

  const p1Char = CHARACTERS.find((c) => c.id === player1.avatarKey) || CHARACTERS[0]
  const p2Char = CHARACTERS.find((c) => c.id === player2.avatarKey) || CHARACTERS[1]

  function handleGameSelect(gameId) {
    setGame(gameId)
    setPhase('PLAYING')
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex items-center justify-center select-none" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <AnimatedBackground
        p1Glow={p1Char.glow}
        p2Glow={p2Char.glow}
        p1GlowPos="10% 20%"
        p2GlowPos="90% 80%"
      />

      {/* Top Left: Player 1 */}
      <div className="absolute top-8 left-8 flex items-center gap-4 animate-bounce-in-left" style={{ animationDelay: '0.1s' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: p1Char.color, boxShadow: `0 0 30px ${p1Char.glow}` }}>
          <span className="material-symbols-outlined text-white text-4xl">person</span>
        </div>
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-gray-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Player 1</p>
          <h2 className="text-2xl font-extrabold text-gray-800" style={{ textShadow: `0 0 20px ${p1Char.glow}` }}>
            {player1.name || 'P1'} <span style={{ color: p1Char.color, opacity: 0.8 }}>({p1Char.name})</span>
          </h2>
        </div>
      </div>

      {/* Bottom Right: Player 2 */}
      <div className="absolute bottom-8 right-8 flex items-center gap-4 text-right animate-bounce-in-right" style={{ animationDelay: '0.1s' }}>
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-gray-500" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Player 2</p>
          <h2 className="text-2xl font-extrabold text-gray-800" style={{ textShadow: `0 0 20px ${p2Char.glow}` }}>
            <span style={{ color: p2Char.color, opacity: 0.8 }}>({p2Char.name})</span> {player2.name || 'P2'}
          </h2>
        </div>
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: p2Char.color, boxShadow: `0 0 30px ${p2Char.glow}` }}>
          <span className="material-symbols-outlined text-white text-4xl">person</span>
        </div>
      </div>

      {/* Center: Games Grid */}
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-2 tracking-tight animate-bounce-in-up" style={{ animationDelay: '0.2s' }}>Select a Game</h1>
        <p className="text-sm text-gray-400 tracking-[0.2em] uppercase mb-10 animate-bounce-in-up" style={{ fontFamily: "'Space Grotesk', sans-serif", animationDelay: '0.3s' }}>Unified Decision</p>

        <div className="grid grid-cols-2 gap-6">
          {GAMES.map((game, index) => (
            <button
              key={game.id}
              onClick={() => handleGameSelect(game.id)}
              className="group relative flex flex-col items-center justify-center w-64 h-48 bg-white/90 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer overflow-hidden animate-pop-in"
              style={{ backdropFilter: 'blur(10px)', animationDelay: `${0.4 + (index * 0.1)}s` }}
            >
              {/* Hover effect gradient */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${game.color}, transparent)` }}
              />
              <span
                className="material-symbols-outlined text-5xl mb-4 transition-transform duration-300 group-hover:scale-110 group-active:scale-95"
                style={{ color: game.color }}
              >
                {game.icon}
              </span>
              <h3 className="text-xl font-bold text-gray-800 tracking-tight">{game.name}</h3>
            </button>
          ))}
        </div>

        <button
          onClick={() => setPhase('CHARACTER_SELECT')}
          className="mt-12 flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors animate-bounce-in-up"
          style={{ fontFamily: "'Space Grotesk', sans-serif", animationDelay: '0.8s' }}
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span className="text-[10px] tracking-widest uppercase">Change Characters</span>
        </button>
      </div>
    </div>
  )
}
