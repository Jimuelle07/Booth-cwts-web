// Shared end-of-match "credits" overlay used by every game.
//
// Shown on a single panel once BOTH players have finished. It rolls a short
// credits sequence, declares the result from this panel's point of view, and
// offers two ways forward: replay the same match, or head back to character
// select to start a brand-new game.
//
// Rendered once per panel (left/right), so every callback is wired to a shared
// store action or the global phase switch — pressing a button on either side
// drives both panels.

import { getCharacterPortrait } from './landing_page/characterImages'

const OUTCOME = {
  win: { icon: 'emoji_events', label: 'YOU WIN!' },
  lose: { icon: 'sentiment_dissatisfied', label: 'DEFEAT' },
  tie: { icon: 'handshake', label: 'DEAD HEAT!' },
}

function CastRow({ char, name, isMe, value, valueLabel }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: char.color,
          boxShadow: `0 0 10px ${char.glow}`,
          flexShrink: 0,
        }}
      />
      <div className="flex flex-col" style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
          {isMe && <span style={{ opacity: 0.55, fontSize: 10, marginLeft: 6 }}>(YOU)</span>}
        </span>
        <span
          style={{
            color: char.color,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {char.name}
        </span>
      </div>
      <div className="flex flex-col items-end" style={{ flexShrink: 0 }}>
        <span
          style={{
            color: '#fff',
            fontWeight: 800,
            fontSize: 18,
            lineHeight: 1,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {value}
        </span>
        <span
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 8,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {valueLabel}
        </span>
      </div>
    </div>
  )
}

function CharacterCard({ char, img, isWinner }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden border border-white/20"
      style={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(180deg, ${char.color}44 0%, rgba(0,0,0,0.9) 100%)`,
        boxShadow: isWinner ? `0 0 40px ${char.glow}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '6px 4px'
      }}
    >
      {img && (
        <img 
          src={img} 
          className="absolute inset-0 w-full h-full object-contain"
          style={{ top: '-10%', height: '110%' }}
          alt={char.name}
        />
      )}
      <div 
        className="relative z-10 w-full text-center py-1 rounded"
        style={{
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          border: `1px solid ${char.color}55`,
          color: char.color,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {char.name}
      </div>
    </div>
  )
}

export default function EndCredits({
  title,
  outcome,
  valueLabel = 'Score',
  subtitle = null,
  myChar,
  myName,
  myValue,
  oppChar,
  oppName,
  oppValue,
  playAgainKey,
  onPlayAgain,
  onBackToSelect,
  isPlayer1,
}) {
  if (isPlayer1 === false) return null;

  const o = OUTCOME[outcome] ?? OUTCOME.tie
  const accent = outcome === 'win' ? myChar.color : outcome === 'lose' ? oppChar.color : '#ffffff'
  const glow = outcome === 'win' ? myChar.glow : outcome === 'lose' ? oppChar.glow : 'rgba(255,255,255,0.3)'

  const winnerChar = outcome === 'lose' ? oppChar : myChar;
  const winnerImg = getCharacterPortrait(winnerChar?.id);
  const winnerName = outcome === 'lose' ? oppName : myName;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: 'rgba(10,8,16,0.94)', backdropFilter: 'blur(10px)' }}
    >
      <style>{`
        @keyframes endCreditsRise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes winnerCardRise {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        className="flex flex-col items-center w-full"
        style={{ maxWidth: 360, animation: 'endCreditsRise 0.5s ease both' }}
      >
        {/* game title strip */}
        <span
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: 10,
            letterSpacing: '0.4em',
            textTransform: 'uppercase',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {title} · Match Complete
        </span>

        {/* result */}
        {outcome === 'tie' ? (
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 64, color: accent, filter: `drop-shadow(0 0 16px ${glow})`, marginTop: 14 }}
          >
            {o.icon}
          </span>
        ) : (
          <div className="relative mt-8 mb-2 w-full flex justify-center items-center" style={{ height: 160 }}>
            {/* Winner Card (Middle) */}
            <div 
              style={{ 
                width: 130, 
                height: 170, 
                animation: 'winnerCardRise 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
                zIndex: 10,
              }}
            >
              <CharacterCard char={winnerChar} img={winnerImg} isWinner={true} />
            </div>
          </div>
        )}
        <div
          style={{
            color: accent,
            fontSize: 34,
            fontWeight: 800,
            marginTop: 8,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          {outcome === 'tie' ? o.label : `${winnerName} WINS!`}
        </div>

        {subtitle && (
          <div
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 12,
              marginTop: 8,
              textAlign: 'center',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {subtitle}
          </div>
        )}

        {/* cast / credits roll */}
        <div
          className="w-full"
          style={{
            marginTop: 20,
            padding: '4px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: 8,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              textAlign: 'center',
              padding: '8px 0 4px',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Starring
          </div>
          <CastRow char={myChar} name={myName} isMe value={myValue} valueLabel={valueLabel} />
          <CastRow char={oppChar} name={oppName} isMe={false} value={oppValue} valueLabel={valueLabel} />
        </div>

        {/* actions */}
        <div className="flex flex-col items-stretch w-full" style={{ marginTop: 22, gap: 10 }}>
          <button
            type="button"
            onClick={onPlayAgain}
            aria-label="Play the same match again"
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: myChar.color,
              color: '#0a0810',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              boxShadow: `0 6px 22px ${myChar.glow}`,
            }}
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onBackToSelect}
            aria-label="Return to character select for a new game"
            style={{
              padding: '11px 20px',
              borderRadius: 12,
              cursor: 'pointer',
              background: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.22)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            New Game · Change Characters
          </button>
        </div>

        {playAgainKey && (
          <div
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: 10,
              marginTop: 14,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            or press {playAgainKey} to play again
          </div>
        )}
      </div>
    </div>
  )
}
