import { useEffect, useRef } from 'react'
import { CHARACTERS } from '../../components/landing_page/CharacterSelect'
import { mazes, ORB_SEQUENCES } from './mazeData'
import useMazeStore from './useMazeStore'

const MOVE_SPEED = 0.05
const HUD_H = 60

// ─── level themes ─────────────────────────────────────────────────────────────
const LEVEL_THEMES = [
  {
    name: 'EASY',
    bgA: '#E8F5E9', bgB: '#C8E6C9',
    wallFill: '#2E7D32', wallStroke: '#81C784', wallGlow: '#43A047',
    floor: '#F4FBF4',
    labelColor: '#1B5E20',
    dotColor: 'rgba(46,125,50,0.09)',
    flashColor: '#A5D6A7',
    badgeBg: '#388E3C', badgeText: '#fff',
  },
  {
    name: 'MEDIUM',
    bgA: '#FFF8E1', bgB: '#FFECB3',
    wallFill: '#E65100', wallStroke: '#FF8A65', wallGlow: '#F4511E',
    floor: '#FFFDF6',
    labelColor: '#BF360C',
    dotColor: 'rgba(230,81,0,0.09)',
    flashColor: '#FFCC80',
    badgeBg: '#F4511E', badgeText: '#fff',
  },
  {
    name: 'HARD',
    bgA: '#EDE7F6', bgB: '#D1C4E9',
    wallFill: '#4527A0', wallStroke: '#9575CD', wallGlow: '#512DA8',
    floor: '#FAF8FF',
    labelColor: '#311B92',
    dotColor: 'rgba(69,39,160,0.09)',
    flashColor: '#CE93D8',
    badgeBg: '#512DA8', badgeText: '#fff',
  },
]

// Inside Out emotion colours — float in the background
const EMOTION_ORBS = [
  { color: '#FFD700', x: 0.08, y: 0.18, r: 0.18, phase: 0.0 },
  { color: '#4A90D9', x: 0.88, y: 0.15, r: 0.14, phase: 1.1 },
  { color: '#E03B1F', x: 0.75, y: 0.82, r: 0.12, phase: 2.3 },
  { color: '#9B59B6', x: 0.15, y: 0.72, r: 0.16, phase: 0.7 },
  { color: '#27AE60', x: 0.50, y: 0.04, r: 0.10, phase: 3.5 },
  { color: '#E91E8C', x: 0.92, y: 0.55, r: 0.13, phase: 1.8 },
  { color: '#E67E22', x: 0.04, y: 0.45, r: 0.11, phase: 2.9 },
]

// ─── canvas helpers ────────────────────────────────────────────────────────────

function drawBackground(ctx, W, H, theme) {
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, theme.bgA)
  grad.addColorStop(1, theme.bgB)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  const t = Date.now() * 0.001
  for (const orb of EMOTION_ORBS) {
    const ox = orb.x * W + Math.sin(t * 0.4 + orb.phase) * 0.035 * W
    const oy = orb.y * H + Math.cos(t * 0.3 + orb.phase) * 0.035 * H
    const radius = orb.r * Math.min(W, H)
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, radius)
    g.addColorStop(0,   orb.color + '55')
    g.addColorStop(0.5, orb.color + '22')
    g.addColorStop(1,   orb.color + '00')
    ctx.beginPath()
    ctx.arc(ox, oy, radius, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()
  }

  ctx.save()
  ctx.globalAlpha = 0.06
  const fs = Math.min(W * 0.38, 155)
  ctx.font = `900 ${fs}px "Plus Jakarta Sans", sans-serif`
  ctx.fillStyle = theme.labelColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(theme.name, W / 2, (H + HUD_H) / 2)
  ctx.restore()

  ctx.fillStyle = theme.dotColor
  const step = 30
  for (let x = step / 2; x < W; x += step) {
    for (let y = HUD_H + step / 2; y < H; y += step) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawMaze(ctx, maze, cell, ox, oy, theme) {
  ctx.fillStyle = theme.floor
  ctx.fillRect(ox, oy, maze.cols * cell, maze.rows * cell)

  // All walls as one continuous filled shape — no per-cell borders
  ctx.beginPath()
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      if (maze.grid[r][c] === 1) {
        ctx.rect(ox + c * cell, oy + r * cell, cell, cell)
      }
    }
  }
  ctx.fillStyle = theme.wallFill
  ctx.fill()

  const mW = maze.cols * cell
  const mH = maze.rows * cell

  ctx.save()
  ctx.shadowColor = theme.wallGlow
  ctx.shadowBlur = 16
  ctx.strokeStyle = theme.wallFill
  ctx.lineWidth = 2.5
  ctx.strokeRect(ox + 1, oy + 1, mW - 2, mH - 2)
  ctx.restore()

  const bS = Math.min(mW, mH) * 0.07
  ctx.save()
  ctx.strokeStyle = theme.wallFill
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.55
  const corners = [
    [ox - 10, oy - 10, 1, 1],
    [ox + mW + 10, oy - 10, -1, 1],
    [ox - 10, oy + mH + 10, 1, -1],
    [ox + mW + 10, oy + mH + 10, -1, -1],
  ]
  for (const [cx, cy, sx, sy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx, cy + sy * bS)
    ctx.lineTo(cx, cy)
    ctx.lineTo(cx + sx * bS, cy)
    ctx.stroke()
  }
  ctx.restore()
}

function drawOrbs(ctx, maze, cell, ox, oy, orbSequence, orbsCollected) {
  const now = Date.now()

  for (let i = orbsCollected; i < 3; i++) {
    const pos = maze.orbPositions[i]
    if (!pos) continue

    const cx = ox + (pos.col + 0.5) * cell
    const cy = oy + (pos.row + 0.5) * cell
    const isNext = i === orbsCollected
    const color = orbSequence.colors[i]
    const pulse = isNext ? 0.88 + 0.12 * Math.sin(now * 0.004) : 1
    const R = cell * 0.32 * (isNext ? pulse : 0.72)

    ctx.save()
    ctx.globalAlpha = isNext ? 1 : 0.38

    // Soft ambient glow ring (next orb only)
    if (isNext) {
      const glow = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.2)
      glow.addColorStop(0, color + '55')
      glow.addColorStop(1, color + '00')
      ctx.beginPath()
      ctx.arc(cx, cy, R * 2.2, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    }

    // Sphere body — off-centre radial gradient for 3D glass look
    ctx.shadowColor = color
    ctx.shadowBlur = isNext ? 14 * pulse : 4
    const sphere = ctx.createRadialGradient(
      cx - R * 0.32, cy - R * 0.32, R * 0.04,
      cx + R * 0.1,  cy + R * 0.1,  R,
    )
    sphere.addColorStop(0,    '#ffffff')
    sphere.addColorStop(0.28, color)
    sphere.addColorStop(1,    color)
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fillStyle = sphere
    ctx.fill()

    // Dark-edge overlay for depth
    ctx.shadowBlur = 0
    const rim = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R)
    rim.addColorStop(0, 'rgba(0,0,0,0)')
    rim.addColorStop(1, 'rgba(0,0,0,0.28)')
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fillStyle = rim
    ctx.fill()

    // Small secondary specular dot (bottom-right reflection)
    ctx.globalAlpha = (isNext ? 0.45 : 0.2)
    ctx.beginPath()
    ctx.arc(cx + R * 0.38, cy + R * 0.38, R * 0.18, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fill()

    ctx.restore()
  }
}

const DIR_ANGLES = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI }

function drawTrail(ctx, trail, r, color) {
  const n = trail.length
  if (n < 3) return

  // Single blurred stroke pass for the outer glow — one path, one draw call
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(trail[0].x, trail[0].y)
  for (let i = 1; i < n; i++) ctx.lineTo(trail[i].x, trail[i].y)
  ctx.strokeStyle = color
  ctx.lineWidth = r * 0.55
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.18
  ctx.shadowColor = color
  ctx.shadowBlur = 14
  ctx.stroke()
  ctx.restore()

  // Fading dots along the path — no extra shadow per dot (glow pass above covers it)
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    const frac = (i + 1) / n             // 0 = oldest, 1 = newest
    ctx.globalAlpha = Math.pow(frac, 1.5) * 0.88
    const dotR = r * (0.07 + frac * 0.16)
    ctx.beginPath()
    ctx.arc(trail[i].x, trail[i].y, dotR, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawPlayer(ctx, px, py, r, color, dir) {
  const angle = DIR_ANGLES[dir] ?? 0

  ctx.save()
  ctx.translate(px, py)
  ctx.rotate(angle)

  ctx.shadowColor = color
  ctx.shadowBlur = 16

  ctx.beginPath()
  ctx.moveTo(r,          0)
  ctx.lineTo(-r * 0.7, -r * 0.75)
  ctx.lineTo(-r * 0.7,  r * 0.75)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  const grad = ctx.createLinearGradient(-r * 0.7, 0, r, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(1, 'rgba(255,255,255,0.42)')
  ctx.beginPath()
  ctx.moveTo(r,          0)
  ctx.lineTo(-r * 0.7, -r * 0.75)
  ctx.lineTo(-r * 0.7,  r * 0.75)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  ctx.restore()
}

// ─── component ────────────────────────────────────────────────────────────────

export default function MazeGame({ canvasId, player1, player2, pressedKeys }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const isP1 = canvasId === 'canvas-left'
  const myKey = isP1 ? 'player1' : 'player2'
  const me = isP1 ? player1 : player2
  const moveKeys = isP1
    ? { up: 'w', down: 's', left: 'a', right: 'd' }
    : { up: 'i', down: 'k', left: 'j', right: 'l' }

  const myChar = CHARACTERS.find((c) => c.id === me.avatarKey) ?? CHARACTERS[0]
  const winnerChar =
    CHARACTERS.find((c) => c.id === (isP1 ? player2.avatarKey : player1.avatarKey)) ?? CHARACTERS[1]

  const winner = useMazeStore((s) => s.winner)
  const myMapIndex = useMazeStore((s) => s[myKey].mapIndex)
  const myOrbsCollected = useMazeStore((s) => s[myKey].orbsCollected ?? 0)
  const selectedMapIndices = useMazeStore((s) => s.selectedMapIndices)

  const winnerName = winner === 'player1' ? player1.name || 'Player 1' : player2.name || 'Player 2'
  const myName = me.name || (isP1 ? 'Player 1' : 'Player 2')

  useEffect(() => {
    const store = useMazeStore.getState()
    store.mount()
    store.initGame()

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    const gs = {
      cellRow: 0, cellCol: 0,
      targetRow: 0, targetCol: 0,
      moveProgress: 1,
      direction: 'right',
      px: 0, py: 0,
    }
    let prevMapIdx = -1
    let flashAlpha = 0
    let flashColor = '#ffffff'

    // Tracks the orb index that was last registered so we don't double-fire
    // when the player stands still on an orb cell.
    let lastCollectedOrbFrame = -1

    const trail = []
    const TRAIL_MAX = 55

    const getMaze = (s) => {
      const idx = s[myKey].mapIndex
      if (idx >= 3 || s.selectedMapIndices.length === 0) return null
      return mazes[s.selectedMapIndices[idx]]
    }

    const resetPos = (maze) => {
      const W = canvas.width
      const H = canvas.height
      const cell = Math.min(W / maze.cols, (H - HUD_H) / maze.rows)
      const ox = (W - cell * maze.cols) / 2
      const oy = HUD_H + ((H - HUD_H) - cell * maze.rows) / 2
      gs.cellRow = maze.start.row
      gs.cellCol = maze.start.col
      gs.targetRow = maze.start.row
      gs.targetCol = maze.start.col
      gs.moveProgress = 1
      gs.direction = 'right'
      gs.px = ox + (maze.start.col + 0.5) * cell
      gs.py = oy + (maze.start.row + 0.5) * cell
      lastCollectedOrbFrame = -1
      trail.length = 0
    }

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const s = useMazeStore.getState()
      const pd = s[myKey]

      if (pd.mapIndex !== prevMapIdx) {
        prevMapIdx = pd.mapIndex
        const nextSlot = Math.min(pd.mapIndex, 2)
        const nextMazeIdx = s.selectedMapIndices[nextSlot] ?? nextSlot
        flashColor = LEVEL_THEMES[nextMazeIdx].flashColor
        flashAlpha = 0.92
        const m = getMaze(s)
        if (m) resetPos(m)
      }

      const levelIdx = Math.min(pd.mapIndex, 2)
      const mazeActualIdx = s.selectedMapIndices[levelIdx] ?? levelIdx
      const theme = LEVEL_THEMES[mazeActualIdx]
      const orbSequence = ORB_SEQUENCES[mazeActualIdx]

      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      drawBackground(ctx, W, H, theme)

      const maze = getMaze(s)

      if (maze) {
        const cell = Math.min(W / maze.cols, (H - HUD_H) / maze.rows)
        const ox = (W - cell * maze.cols) / 2
        const oy = HUD_H + ((H - HUD_H) - cell * maze.rows) / 2
        const r = cell * 0.32

        drawMaze(ctx, maze, cell, ox, oy, theme)

        if (!s.winner) {
          if (pressedKeys.has(moveKeys.up))         gs.direction = 'up'
          else if (pressedKeys.has(moveKeys.down))  gs.direction = 'down'
          else if (pressedKeys.has(moveKeys.left))  gs.direction = 'left'
          else if (pressedKeys.has(moveKeys.right)) gs.direction = 'right'

          if (gs.moveProgress >= 1) {
            gs.cellRow = gs.targetRow
            gs.cellCol = gs.targetCol

            let dr = 0, dc = 0
            if (pressedKeys.has(moveKeys.up))         dr = -1
            else if (pressedKeys.has(moveKeys.down))  dr =  1
            else if (pressedKeys.has(moveKeys.left))  dc = -1
            else if (pressedKeys.has(moveKeys.right)) dc =  1

            if (dr !== 0 || dc !== 0) {
              const nr = gs.cellRow + dr
              const nc = gs.cellCol + dc
              if (nr >= 0 && nr < maze.rows && nc >= 0 && nc < maze.cols && maze.grid[nr][nc] === 0) {
                gs.targetRow = nr
                gs.targetCol = nc
                gs.moveProgress = 0
              }
            }

            // Orb collection: only the NEXT orb in sequence can be picked up.
            // lastCollectedOrbFrame tracks which orb index triggered last time
            // so the player must move away before it can fire again.
            const orbsCollected = pd.orbsCollected
            const nextOrb = maze.orbPositions?.[orbsCollected]
            if (
              nextOrb &&
              gs.cellRow === nextOrb.row &&
              gs.cellCol === nextOrb.col &&
              lastCollectedOrbFrame !== orbsCollected
            ) {
              lastCollectedOrbFrame = orbsCollected
              useMazeStore.getState().collectOrb(myKey)
            }
          } else {
            gs.moveProgress = Math.min(1, gs.moveProgress + MOVE_SPEED)
          }

          const t = gs.moveProgress * gs.moveProgress * (3 - 2 * gs.moveProgress)
          gs.px = (ox + (gs.cellCol  + 0.5) * cell) * (1 - t) + (ox + (gs.targetCol + 0.5) * cell) * t
          gs.py = (oy + (gs.cellRow  + 0.5) * cell) * (1 - t) + (oy + (gs.targetRow + 0.5) * cell) * t

          // Sample trail only while the player is actually sliding between cells
          if (gs.moveProgress < 1) {
            trail.push({ x: gs.px, y: gs.py })
            if (trail.length > TRAIL_MAX) trail.shift()
          }
        }

        drawOrbs(ctx, maze, cell, ox, oy, orbSequence, pd.orbsCollected)
        drawTrail(ctx, trail, r, myChar.color)
        drawPlayer(ctx, gs.px, gs.py, r, myChar.color, gs.direction)
      }

      if (flashAlpha > 0) {
        ctx.globalAlpha = flashAlpha
        ctx.fillStyle = flashColor
        ctx.fillRect(0, 0, W, H)
        ctx.globalAlpha = 1
        flashAlpha = Math.max(0, flashAlpha - 0.028)
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      useMazeStore.getState().unmount()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clampedMapIndex = Math.min(myMapIndex, 2)
  const mazeActualIdx = selectedMapIndices.length > 0
    ? (selectedMapIndices[clampedMapIndex] ?? clampedMapIndex)
    : clampedMapIndex
  const theme = LEVEL_THEMES[mazeActualIdx]
  const orbSequence = ORB_SEQUENCES[mazeActualIdx]

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: theme.bgA }}>
      {/* HUD */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center px-4 gap-3"
        style={{
          height: HUD_H,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(6px)',
          borderBottom: `2px solid ${theme.wallFill}33`,
        }}
      >
        {/* Player name + level badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            style={{
              color: myChar.color,
              fontWeight: 800,
              fontSize: 14,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              filter: 'brightness(0.82)',
            }}
          >
            {myName}
          </span>
          <span
            style={{
              background: theme.badgeBg,
              color: theme.badgeText,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.14em',
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {theme.name}
          </span>
        </div>

        {/* Orb sequence indicator — center */}
        <div className="flex-1 flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                title={orbSequence.names[i]}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: i < myOrbsCollected ? 'rgba(0,0,0,0.12)' : orbSequence.colors[i],
                  opacity: i > myOrbsCollected ? 0.35 : 1,
                  border: i === myOrbsCollected
                    ? '2.5px solid rgba(255,255,255,0.95)'
                    : i < myOrbsCollected
                      ? '1.5px solid rgba(0,0,0,0.1)'
                      : '1.5px solid rgba(0,0,0,0.1)',
                  boxShadow: i === myOrbsCollected
                    ? `0 0 10px ${orbSequence.colors[i]}, 0 0 4px ${orbSequence.colors[i]}`
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 800,
                  color: i < myOrbsCollected ? 'rgba(0,0,0,0.25)' : '#fff',
                  fontFamily: "'Space Grotesk', sans-serif",
                  transition: 'all 0.25s',
                  flexShrink: 0,
                }}
              >
                {i < myOrbsCollected ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <span style={{ color: 'rgba(0,0,0,0.2)', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                  →
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Map progress — right */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            style={{
              color: theme.wallFill,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {clampedMapIndex + 1}/3
          </span>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  i < clampedMapIndex
                    ? theme.wallFill
                    : i === clampedMapIndex
                      ? theme.wallFill + '44'
                      : 'rgba(0,0,0,0.1)',
                boxShadow: i < clampedMapIndex ? `0 0 6px ${theme.wallGlow}` : 'none',
                transition: 'background 0.3s, box-shadow 0.3s',
              }}
            />
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* Win / lose overlay */}
      {winner && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center"
          style={{ background: `${theme.bgA}ee`, backdropFilter: 'blur(8px)' }}
        >
          {winner === myKey ? (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 72, color: myChar.color, filter: 'brightness(0.85)' }}>emoji_events</span>
              <div
                style={{
                  color: myChar.color,
                  fontSize: 38,
                  fontWeight: 800,
                  marginTop: 20,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  filter: 'brightness(0.82)',
                }}
              >
                YOU WIN!
              </div>
              <div
                style={{
                  color: 'rgba(0,0,0,0.4)',
                  fontSize: 13,
                  marginTop: 10,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {myName} finished first
              </div>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 72, color: 'rgba(0,0,0,0.2)' }}>sentiment_dissatisfied</span>
              <div
                style={{
                  color: winnerChar.color,
                  fontSize: 32,
                  fontWeight: 800,
                  marginTop: 20,
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  filter: 'brightness(0.82)',
                }}
              >
                {winnerName} Wins!
              </div>
              <div
                style={{
                  color: 'rgba(0,0,0,0.4)',
                  fontSize: 13,
                  marginTop: 10,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Better luck next time
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
