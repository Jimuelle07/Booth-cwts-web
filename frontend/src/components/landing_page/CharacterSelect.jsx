import { useState } from 'react'
import useGameStore from '../../store/useGameStore'
import AnimatedBackground from './AnimatedBackground'
import { getCharacterPortrait } from './characterImages'

export const CHARACTERS = [
  { id: 'joy',           name: 'Joy',           color: '#FFD700', glow: 'rgba(255,215,0,0.35)' },
  { id: 'sadness',       name: 'Sadness',       color: '#4A90D9', glow: 'rgba(74,144,217,0.35)' },
  { id: 'anger',         name: 'Anger',         color: '#E03B1F', glow: 'rgba(224,59,31,0.35)' },
  { id: 'fear',          name: 'Fear',          color: '#9B59B6', glow: 'rgba(155,89,182,0.35)' },
  { id: 'disgust',       name: 'Disgust',       color: '#27AE60', glow: 'rgba(39,174,96,0.35)' },
  { id: 'anxiety',       name: 'Anxiety',       color: '#E67E22', glow: 'rgba(230,126,34,0.35)' },
  { id: 'envy',          name: 'Envy',          color: '#1ABC9C', glow: 'rgba(26,188,156,0.35)' },
  { id: 'embarrassment', name: 'Embarrassment', color: '#E91E8C', glow: 'rgba(233,30,140,0.35)' },
  { id: 'ennui',         name: 'Ennui',         color: '#4A5ADB', glow: 'rgba(74,90,219,0.35)' },
]

const N = CHARACTERS.length

// card carousel geometry
const CARD_W      = 270
const CARD_GAP    = 16
const CARD_SLOT   = CARD_W + CARD_GAP              // 286
const CARD_PEEK   = 44
// container shows center card + CARD_PEEK of each adjacent card
const CARD_CONT_W = 2 * CARD_SLOT - CARD_W + 2 * CARD_PEEK  // 390
// TX that centers the offset-0 item
const CARD_DEF_TX = CARD_PEEK - CARD_SLOT - CARD_W           // -512

// circle carousel geometry
const CIRC_W      = 36
const CIRC_GAP    = 10
const CIRC_SLOT   = CIRC_W + CIRC_GAP             // 46
const CIRC_CONT_W = 3 * CIRC_W + 2 * CIRC_GAP    // 128
const CIRC_DEF_TX = -CIRC_SLOT                    // -46

const SLIDE_MS = 450
const EASING   = 'cubic-bezier(0.25,1,0.5,1)'

function CharacterPanel({ playerLabel, charIndex, name, onCharChange, onNameChange }) {
  const char = CHARACTERS[charIndex]
  const [dir, setDir]           = useState(0)
  const [animating, setAnimating] = useState(false)
  const entranceClass = playerLabel === 'Player 1' ? 'animate-bounce-in-left' : 'animate-bounce-in-right'

  function navigate(d) {
    if (animating) return
    setDir(d === 'next' ? -1 : 1)
    setAnimating(true)
    setTimeout(() => {
      onCharChange(d === 'next' ? (charIndex + 1) % N : (charIndex - 1 + N) % N)
      setDir(0)
      setAnimating(false)
    }, SLIDE_MS)
  }

  const items = [-2, -1, 0, 1, 2].map((o) => ({
    char: CHARACTERS[(charIndex + o + N) % N],
    offset: o,
  }))

  const slideTx = animating ? `transform ${SLIDE_MS}ms ${EASING}` : 'none'

  return (
    <section
      className={`flex-1 min-w-0 flex flex-col items-center relative overflow-hidden rounded-xl ${entranceClass}`}
      style={{
        background: 'transparent',
        animationDelay: '0.2s'
      }}
    >
      {/* ambient gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${char.color}22 0%, transparent 65%)`,
          transition: 'background 0.7s',
        }}
      />

      {/* header */}
      <div className="relative z-10 text-center pt-8 w-full shrink-0">
        <p
          className="text-[10px] tracking-[0.3em] uppercase mb-1"
          style={{ color: char.color, fontFamily: "'Space Grotesk', sans-serif", opacity: 0.65 }}
        >
          {playerLabel}
        </p>
        <h2
          className="text-4xl font-extrabold tracking-tight"
          style={{
            color: char.color,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            textShadow: `0 0 24px ${char.glow}, 0 0 60px ${char.glow}`,
            transition: 'color 0.3s, text-shadow 0.3s',
          }}
        >
          {char.name.toUpperCase()}
        </h2>
      </div>

      {/* ── card carousel ── */}
      <div className="relative z-10 flex items-center justify-center flex-1 w-full min-h-0 py-3 overflow-hidden">
        <div
          style={{
            width: CARD_CONT_W,
            height: 460,
            maxHeight: '100%',
            overflow: 'hidden',
            perspective: '1200px',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: CARD_GAP,
              height: '100%',
              transform: `translateX(${CARD_DEF_TX + dir * CARD_SLOT}px)`,
              transition: slideTx,
            }}
          >
            {items.map(({ char: c, offset }, i) => {
              const portrait = getCharacterPortrait(c.id)
              const flip =
                (playerLabel === 'Player 1' && c.id === 'ennui') ||
                (playerLabel === 'Player 2' && ['anger', 'fear', 'anxiety'].includes(c.id))
              
              let imgTransform = `${flip ? 'scaleX(-1) ' : ''}scale(1.7) translateZ(30px)`
              if (c.id === 'anxiety') {
                if (playerLabel === 'Player 1') {
                  imgTransform = `translate(24px, 8px) ${imgTransform}`
                } else {
                  imgTransform = `translate(-28px, 12px) ${imgTransform}`
                }
              }
              return (
              <div
                key={i}
                style={{
                  width: CARD_W,
                  // no explicit height — flex stretch fills parent's height
                  flexShrink: 0,
                  borderRadius: 14,
                  background: `linear-gradient(160deg, ${c.color}dd 0%, ${c.color}55 100%)`,
                  border: '1px solid rgba(255,255,255,0.15)',
                  boxShadow:
                    offset === 0
                      ? `inset 0 4px 10px rgba(255,255,255,0.4), inset 0 -8px 0 rgba(0,0,0,0.2), 0 12px 0 ${c.color}66, 0 24px 48px ${c.glow}`
                      : `inset 0 2px 4px rgba(255,255,255,0.1), inset 0 -4px 0 rgba(0,0,0,0.15), 0 6px 0 ${c.color}33, 0 10px 20px rgba(0,0,0,0.1)`,
                  opacity: offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.6 : 0.2,
                  transform:
                    offset === 0 
                      ? 'scale(1) rotateY(0deg) translateZ(40px)' 
                      : `scale(${1 - Math.abs(offset) * 0.1}) rotateY(${offset > 0 ? -25 : 25}deg) translateZ(0)`,
                  transition: `opacity ${SLIDE_MS}ms ${EASING}, transform ${SLIDE_MS}ms ${EASING}, box-shadow ${SLIDE_MS}ms ${EASING}`,
                  transformStyle: 'preserve-3d',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 14,
                }}
              >
                {portrait ? (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      animation: offset === 0 ? 'character-bounce 2s ease-in-out infinite' : 'none',
                    }}
                  >
                    <img
                      src={portrait}
                      alt={c.name}
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: 4,
                        transform: imgTransform,
                        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.3))',
                      }}
                    />
                  </div>
                ) : (
                  offset === 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.25em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.25)',
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      character
                    </span>
                  )
                )}
              </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── card carousel ── */}
      <div
        className="relative z-20 w-[90%] max-w-xs mb-2 rounded-lg p-2 shrink-0"
        style={{ background: 'transparent' }}
      >
        <label
          className="block text-center text-[10px] tracking-[0.18em] uppercase mb-1"
          style={{ color: char.color, fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {playerLabel} Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter Name"
          maxLength={16}
          className="w-full text-center text-sm font-semibold bg-transparent outline-none placeholder-gray-400 text-gray-800"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        />
      </div>

      {/* ── circle carousel ── */}
      <div
        className="relative z-20 w-[90%] max-w-xs mb-4 rounded-lg px-3 py-2 flex items-center justify-center gap-3 shrink-0"
        style={{ background: 'transparent' }}
      >
        <button
          onClick={() => navigate('prev')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 transition-colors shrink-0"
          style={{ color: char.color }}
        >
          <span className="material-symbols-outlined text-xl select-none">chevron_left</span>
        </button>

        {/* clipping window + fixed ring overlay */}
        <div
          style={{
            position: 'relative',
            width: CIRC_CONT_W,
            height: CIRC_W + 10,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* fixed white ring — never moves */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: CIRC_W + 8,
              height: CIRC_W + 8,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.8)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />

          {/* scrolling strip */}
          <div
            style={{
              display: 'flex',
              gap: CIRC_GAP,
              alignItems: 'center',
              height: '100%',
              position: 'relative',
              zIndex: 1,
              transform: `translateX(${CIRC_DEF_TX + dir * CIRC_SLOT}px)`,
              transition: slideTx,
            }}
          >
            {items.map(({ char: c, offset }, i) => (
              <div
                key={i}
                style={{
                  width: CIRC_W,
                  height: CIRC_W,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: c.color,
                  opacity: offset === 0 ? 1 : 0.3,
                  transition: `opacity ${SLIDE_MS}ms ${EASING}`,
                }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate('next')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-black/5 transition-colors shrink-0"
          style={{ color: char.color }}
        >
          <span className="material-symbols-outlined text-xl select-none">chevron_right</span>
        </button>
      </div>
    </section>
  )
}

export default function CharacterSelect() {
  const { setPhase, setPlayer1, setPlayer2 } = useGameStore()

  const [p1CharIndex, setP1CharIndex] = useState(0)
  const [p2CharIndex, setP2CharIndex] = useState(2)
  const [p1Name, setP1Name] = useState('')
  const [p2Name, setP2Name] = useState('')
  const [p1Ready, setP1Ready] = useState(false)
  const [p2Ready, setP2Ready] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const p1Char = CHARACTERS[p1CharIndex]
  const p2Char = CHARACTERS[p2CharIndex]

  function handleP1Ready() {
    setPlayer1({ name: p1Name || 'Player 1', avatarKey: p1Char.id })
    setP1Ready(true)
    if (p2Ready) startGame()
  }

  function handleP2Ready() {
    setPlayer2({ name: p2Name || 'Player 2', avatarKey: p2Char.id })
    setP2Ready(true)
    if (p1Ready) startGame()
  }

  function startGame() {
    if (isTransitioning) return
    setIsTransitioning(true)
    setPlayer1({ name: p1Name || 'Player 1', avatarKey: p1Char.id })
    setPlayer2({ name: p2Name || 'Player 2', avatarKey: p2Char.id })
    
    setTimeout(() => {
      setPhase('GAME_SELECT')
    }, 750)
  }

  const bothReady = p1Ready && p2Ready

  return (
    <div
      className="relative flex flex-col w-screen h-screen overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <AnimatedBackground p1Glow={p1Char.glow.replace('0.35', '0.17')} p2Glow={p2Char.glow.replace('0.35', '0.17')} />
      <header className="shrink-0 flex items-center justify-center pt-5 pb-2 relative z-10 animate-bounce-in-down" style={{ animationDelay: '0.1s' }}>
        <button
          onClick={() => setPhase('LANDING_PAGE')}
          className="absolute left-6 flex items-center gap-1 text-gray-400 hover:text-gray-700 transition-colors"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span className="text-[10px] tracking-widest uppercase">Back</span>
        </button>
        <h1
          className="text-2xl font-extrabold tracking-tight text-gray-800"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Booth<span style={{ color: p1Char.color, transition: 'color 0.3s' }}>.</span>
        </h1>
        <span
          className="ml-3 text-[10px] tracking-[0.3em] uppercase text-gray-400"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Character Select
        </span>
      </header>

      <main className="flex-1 flex flex-row gap-1 px-4 pb-2 min-h-0 relative z-[100]">
        <CharacterPanel
          playerLabel="Player 1"
          charIndex={p1CharIndex}
          name={p1Name}
          onCharChange={(i) => { setP1CharIndex(i); setP1Ready(false) }}
          onNameChange={setP1Name}
        />

        <div className="hidden md:flex flex-col items-center justify-center w-10 shrink-0 relative z-[200]">
          <div
            className="h-full w-px"
            style={{
              background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.1), transparent)',
              opacity: isTransitioning ? 0 : 1,
              transition: 'opacity 0.3s'
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[300] animate-pop-in" style={{ animationDelay: '0.4s' }}>
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 48,
                height: 48,
                background: isTransitioning ? '#fdfbf7' : '#ffffff',
                border: isTransitioning ? 'none' : '2px solid rgba(0,0,0,0.05)',
                boxShadow: isTransitioning ? 'none' : '0 4px 14px rgba(0,0,0,0.05)',
                transform: isTransitioning ? 'scale(80)' : 'scale(1)',
                transition: 'transform 0.8s cubic-bezier(0.7, 0, 0.3, 1), background-color 0.4s',
              }}
            >
            <span
              className="text-gray-400 font-bold italic text-xs tracking-widest"
              style={{ 
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                opacity: isTransitioning ? 0 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              VS
            </span>
            </div>
          </div>
        </div>

        <CharacterPanel
          playerLabel="Player 2"
          charIndex={p2CharIndex}
          name={p2Name}
          onCharChange={(i) => { setP2CharIndex(i); setP2Ready(false) }}
          onNameChange={setP2Name}
        />
      </main>

      <nav
        className="shrink-0 flex items-center gap-1 px-4 py-4 z-50 animate-bounce-in-up"
        style={{
          background: 'transparent',
          animationDelay: '0.5s'
        }}
      >
        <div className="flex-1 flex justify-center">
          <button
            onClick={handleP1Ready}
            disabled={p1Ready}
            className={`flex flex-col items-center justify-center rounded-xl w-44 h-16 cursor-pointer disabled:cursor-default overflow-hidden transition-all duration-200 ${!p1Ready ? 'hover:-translate-y-1 active:translate-y-1' : ''}`}
            style={{
              background: p1Ready ? p1Char.color : '#ffffff',
              color: p1Ready ? '#ffffff' : p1Char.color,
              border: `2px solid ${p1Ready ? 'transparent' : p1Char.color + '66'}`,
              boxShadow: p1Ready 
                ? `0 3px 0 rgba(0,0,0,0.2) inset, 0 4px 20px ${p1Char.glow}` 
                : `0 6px 0 ${p1Char.color}66, 0 8px 16px rgba(0,0,0,0.1)`,
              fontFamily: "'Space Grotesk', sans-serif",
              transform: p1Ready ? 'translateY(4px)' : undefined,
            }}
          >
            <span className="material-symbols-outlined text-xl leading-none">
              {p1Ready ? 'check_circle' : 'person'}
            </span>
            <span className="text-xs font-bold tracking-widest uppercase mt-1 leading-none">
              {p1Ready ? 'Ready!' : 'Player 1 Ready'}
            </span>
          </button>
        </div>

        <div className="w-10 shrink-0 flex justify-center">
          {bothReady ? (
            <button
              onClick={startGame}
              className="px-10 py-3 rounded-xl font-extrabold text-sm tracking-widest uppercase text-gray-950 hover:-translate-y-1 active:translate-y-1 transition-all duration-200 cursor-pointer"
              style={{
                background: `linear-gradient(90deg, ${p1Char.color}, ${p2Char.color})`,
                boxShadow: `0 6px 0 rgba(0,0,0,0.15), 0 8px 28px ${p1Char.glow}, 0 8px 28px ${p2Char.glow}`,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Fight!
            </button>
          ) : (
            <div
              className="w-28 h-10 rounded-lg flex items-center justify-center"
              style={{ border: '1px dashed rgba(0,0,0,0.1)' }}
            >
              <span
                className="text-gray-400 text-[10px] tracking-widest uppercase"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                waiting...
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 flex justify-center">
          <button
            onClick={handleP2Ready}
            disabled={p2Ready}
            className={`flex flex-col items-center justify-center rounded-xl w-44 h-16 cursor-pointer disabled:cursor-default overflow-hidden transition-all duration-200 ${!p2Ready ? 'hover:-translate-y-1 active:translate-y-1' : ''}`}
            style={{
              background: p2Ready ? p2Char.color : '#ffffff',
              color: p2Ready ? '#ffffff' : p2Char.color,
              border: `2px solid ${p2Ready ? 'transparent' : p2Char.color + '66'}`,
              boxShadow: p2Ready 
                ? `0 3px 0 rgba(0,0,0,0.2) inset, 0 4px 20px ${p2Char.glow}` 
                : `0 6px 0 ${p2Char.color}66, 0 8px 16px rgba(0,0,0,0.1)`,
              fontFamily: "'Space Grotesk', sans-serif",
              transform: p2Ready ? 'translateY(4px)' : undefined,
            }}
          >
            <span className="material-symbols-outlined text-xl leading-none">
              {p2Ready ? 'check_circle' : 'person'}
            </span>
            <span className="text-xs font-bold tracking-widest uppercase mt-1 leading-none">
              {p2Ready ? 'Ready!' : 'Player 2 Ready'}
            </span>
          </button>
        </div>
      </nav>
    </div>
  )
}
