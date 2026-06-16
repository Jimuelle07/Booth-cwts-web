import { useEffect, useRef, useState } from 'react'
import { CHARACTERS } from '../../components/landing_page/CharacterSelect'
import useGameStore from '../../store/useGameStore'
import EndCredits from '../../components/EndCredits'
import useBowlingStore, { FRAMES, PINS } from './useBowlingStore'

const HUD_H = 64

// ─── tunables ───────────────────────────────────────────────────────────────
// Speeds / distances are expressed as fractions of the lane length so the game
// feels identical on any canvas size.
const SUBSTEPS = 4 // physics sub-steps per frame (collision stability)
const BALL_MASS = 8
const PIN_MASS = 1
const BALL_FR = 0.9935 // ball rolling friction (per frame)
const PIN_FR = 0.9 // pins lose speed quickly once knocked
const REST_BALL_PIN = 0.4
const REST_PIN_PIN = 0.5
const CURVE_ACC = 0.0045 // hook strength (relative to lane width)
const POWER_SPEED = 0.055 // power-meter oscillation rate
const SPIN_SPEED = 0.045 // spin-meter oscillation rate
const AIM_SPEED = 0.0042 // aim travel per frame (fraction of lane width)
const RESULT_HOLD = 70 // frames the roll result is shown before submitting
const MAX_ROLL_FRAMES = 540 // safety timeout so a roll always settles

// ─── geometry ────────────────────────────────────────────────────────────────
// Everything the renderer/physics needs, derived from the current canvas size.
function computeLayout(W, H) {
  const top = HUD_H + 14
  const bottom = H - 18
  const laneLen = bottom - top
  const laneW = Math.min(W * 0.5, laneLen * 0.36)
  const cx = W / 2
  const laneLeft = cx - laneW / 2
  const laneRight = cx + laneW / 2
  const gutterW = laneW * 0.13
  const pinR = laneW * 0.052
  const ballR = pinR * 1.7
  const foulY = bottom - ballR - 6
  const headY = top + laneLen * 0.15 // head pin (nearest the bowler)
  const spacingX = laneW * 0.165
  const spacingY = spacingX * 0.9
  return {
    W, H, top, bottom, laneLen, laneW, cx,
    laneLeft, laneRight, gutterW, pinR, ballR, foulY, headY, spacingX, spacingY,
  }
}

// Standard triangle: row 0 = head pin nearest bowler, rows recede up-lane.
function makePins(L) {
  const pins = []
  for (let row = 0; row < 4; row++) {
    const y = L.headY - row * L.spacingY
    for (let i = 0; i <= row; i++) {
      const x = L.cx + (i - row / 2) * L.spacingX
      pins.push({
        x, y, homeX: x, homeY: y, vx: 0, vy: 0,
        state: 'standing', // 'standing' | 'falling' | 'down'
        fallDir: 0, fallProg: 0,
      })
    }
  }
  return pins
}

function freshBall(L) {
  return { x: L.cx, y: L.foulY, vx: 0, vy: 0, spin: 0, throwSpeed: 1, gone: false }
}

// ─── physics ─────────────────────────────────────────────────────────────────
function resolveCircle(a, b, ma, mb, restitution) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const minD = a.r + b.r
  const d2 = dx * dx + dy * dy
  if (d2 >= minD * minD || d2 === 0) return false
  const d = Math.sqrt(d2)
  const nx = dx / d
  const ny = dy / d

  // positional correction weighted by inverse mass
  const overlap = minD - d
  const invA = 1 / ma
  const invB = 1 / mb
  const corr = overlap / (invA + invB)
  a.x -= nx * corr * invA
  a.y -= ny * corr * invA
  b.x += nx * corr * invB
  b.y += ny * corr * invB

  const rvx = b.vx - a.vx
  const rvy = b.vy - a.vy
  const vn = rvx * nx + rvy * ny
  if (vn > 0) return true // already separating
  const imp = (-(1 + restitution) * vn) / (invA + invB)
  a.vx -= imp * nx * invA
  a.vy -= imp * ny * invA
  b.vx += imp * nx * invB
  b.vy += imp * ny * invB
  return true
}

// ─── drawing ─────────────────────────────────────────────────────────────────
function drawLane(ctx, L) {
  const { top, bottom, laneLeft, laneRight, laneW, gutterW, headY, spacingY } = L

  // back wall behind the pins
  const wallGrad = ctx.createLinearGradient(0, top - 14, 0, headY)
  wallGrad.addColorStop(0, '#15131c')
  wallGrad.addColorStop(1, '#241f30')
  ctx.fillStyle = wallGrad
  ctx.fillRect(laneLeft - gutterW, top - 14, laneW + gutterW * 2, headY - top - spacingY * 2.6)

  // gutters
  ctx.fillStyle = '#2c2a36'
  roundRect(ctx, laneLeft - gutterW, top, gutterW, bottom - top, 6)
  ctx.fill()
  roundRect(ctx, laneRight, top, gutterW, bottom - top, 6)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, laneLeft - gutterW + 2, top, gutterW * 0.45, bottom - top, 4)
  ctx.fill()
  roundRect(ctx, laneRight + gutterW * 0.55 - 2, top, gutterW * 0.45, bottom - top, 4)
  ctx.fill()

  // lane wood
  const wood = ctx.createLinearGradient(0, top, 0, bottom)
  wood.addColorStop(0, '#e8c79a')
  wood.addColorStop(0.5, '#d9a86f')
  wood.addColorStop(1, '#caa06a')
  ctx.fillStyle = wood
  roundRect(ctx, laneLeft, top, laneW, bottom - top, 4)
  ctx.fill()

  // planks
  ctx.save()
  roundRect(ctx, laneLeft, top, laneW, bottom - top, 4)
  ctx.clip()
  ctx.strokeStyle = 'rgba(120,80,40,0.18)'
  ctx.lineWidth = 1
  const planks = 13
  for (let i = 1; i < planks; i++) {
    const x = laneLeft + (laneW / planks) * i
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.stroke()
  }
  // sheen down the middle
  const sheen = ctx.createLinearGradient(laneLeft, 0, laneRight, 0)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.22)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(laneLeft, top, laneW, bottom - top)
  ctx.restore()

  // pin-deck shadow line
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(laneLeft, headY + spacingY * 0.9)
  ctx.lineTo(laneRight, headY + spacingY * 0.9)
  ctx.stroke()

  // targeting arrows (classic 7-arrow set ~1/3 up the lane)
  const arrowY = bottom - (bottom - top) * 0.34
  ctx.fillStyle = 'rgba(90,55,20,0.4)'
  for (let i = -3; i <= 3; i++) {
    const ax = L.cx + i * (laneW / 9)
    const ay = arrowY + Math.abs(i) * 10
    const s = laneW * 0.028
    ctx.beginPath()
    ctx.moveTo(ax, ay - s)
    ctx.lineTo(ax - s * 0.7, ay + s * 0.7)
    ctx.lineTo(ax + s * 0.7, ay + s * 0.7)
    ctx.closePath()
    ctx.fill()
  }

  // foul line
  ctx.strokeStyle = 'rgba(150,30,30,0.55)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(laneLeft, L.foulY + L.ballR + 4)
  ctx.lineTo(laneRight, L.foulY + L.ballR + 4)
  ctx.stroke()
}

function drawPin(ctx, p, L) {
  if (p.state === 'down' && p.fallProg >= 1) {
    // settled, lying flat — faint debris
    ctx.save()
    ctx.globalAlpha = 0.32
    ctx.translate(p.x, p.y)
    ctx.rotate(p.fallDir)
    ctx.fillStyle = '#cfc8c0'
    ctx.beginPath()
    ctx.ellipse(0, 0, L.pinR * 1.7, L.pinR * 0.55, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  const fallen = p.state !== 'standing'
  ctx.save()
  ctx.translate(p.x, p.y)

  // cast shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(L.pinR * 0.35, L.pinR * 0.45, L.pinR * (fallen ? 1.5 : 1.05), L.pinR * 0.6, 0, 0, Math.PI * 2)
  ctx.fill()

  if (fallen) ctx.rotate(p.fallDir)
  const stretch = fallen ? 1 + p.fallProg * 0.9 : 1
  const squash = fallen ? 1 - p.fallProg * 0.45 : 1

  // pin cap (top-down view) — glossy white body
  const g = ctx.createRadialGradient(
    -L.pinR * 0.3, -L.pinR * 0.3, L.pinR * 0.1,
    0, 0, L.pinR * 1.1,
  )
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.7, '#f1ede6')
  g.addColorStop(1, '#cdc6bb')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, 0, L.pinR * stretch, L.pinR * squash, 0, 0, Math.PI * 2)
  ctx.fill()

  // red neck stripe ring
  ctx.strokeStyle = 'rgba(214,40,40,0.85)'
  ctx.lineWidth = L.pinR * 0.28
  ctx.beginPath()
  ctx.ellipse(0, 0, L.pinR * 0.62 * stretch, L.pinR * 0.62 * squash, 0, 0, Math.PI * 2)
  ctx.stroke()

  ctx.restore()
}

function drawBall(ctx, ball, color, L) {
  ctx.save()
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(ball.x + L.ballR * 0.25, ball.y + L.ballR * 0.3, L.ballR * 1.02, L.ballR * 0.92, 0, 0, Math.PI * 2)
  ctx.fill()

  const g = ctx.createRadialGradient(
    ball.x - L.ballR * 0.35, ball.y - L.ballR * 0.35, L.ballR * 0.1,
    ball.x, ball.y, L.ballR,
  )
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.25, color)
  g.addColorStop(1, shade(color, -0.45))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(ball.x, ball.y, L.ballR, 0, Math.PI * 2)
  ctx.fill()

  // finger holes
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  const holes = [[-0.25, -0.25], [0.05, -0.32], [-0.1, -0.02]]
  for (const [hx, hy] of holes) {
    ctx.beginPath()
    ctx.arc(ball.x + hx * L.ballR, ball.y + hy * L.ballR, L.ballR * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }

  // specular highlight
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.arc(ball.x - L.ballR * 0.38, ball.y - L.ballR * 0.42, L.ballR * 0.18, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// dotted aiming guide; curves with the chosen spin during the spin phase
function drawGuide(ctx, ball, L, spin) {
  ctx.save()
  ctx.setLineDash([4, 9])
  ctx.lineWidth = 2.5
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  let x = ball.x
  let y = ball.y
  let vx = 0
  const vy = -L.laneLen * 0.02
  ctx.moveTo(x, y)
  for (let i = 0; i < 60 && y > L.headY; i++) {
    vx += spin * L.laneW * CURVE_ACC * 0.55
    x += vx
    y += vy
    if (x < L.laneLeft || x > L.laneRight) break
    ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()
}

function drawPowerMeter(ctx, L, value) {
  const x = L.laneLeft - L.gutterW - 26
  const h = L.laneLen * 0.55
  const y = L.bottom - h
  const w = 12
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  roundRect(ctx, x, y, w, h, 6)
  ctx.fill()
  const fillH = h * value
  const grad = ctx.createLinearGradient(0, y + h, 0, y)
  grad.addColorStop(0, '#2ecc71')
  grad.addColorStop(0.6, '#f1c40f')
  grad.addColorStop(1, '#e74c3c')
  ctx.fillStyle = grad
  roundRect(ctx, x, y + h - fillH, w, fillH, 6)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = '700 9px "Space Grotesk", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('PWR', x + w / 2, y - 6)
}

function drawSpinMeter(ctx, L, value) {
  const w = L.laneW * 0.8
  const x = L.cx - w / 2
  const y = L.foulY + L.ballR + 16
  const h = 10
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  roundRect(ctx, x, y, w, h, 5)
  ctx.fill()
  // center tick
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(L.cx, y - 2)
  ctx.lineTo(L.cx, y + h + 2)
  ctx.stroke()
  // marker
  const mx = L.cx + (value * w) / 2
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(mx, y + h / 2, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = '700 9px "Space Grotesk", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('◀ HOOK ▶', L.cx, y + h + 16)
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  r = Math.round(Math.min(255, Math.max(0, r + amt * 255)))
  g = Math.round(Math.min(255, Math.max(0, g + amt * 255)))
  b = Math.round(Math.min(255, Math.max(0, b + amt * 255)))
  return `rgb(${r},${g},${b})`
}

// ─── component ────────────────────────────────────────────────────────────────
export default function BowlingGame({ canvasId, player1, player2, pressedKeys }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const isP1 = canvasId === 'canvas-left'
  const myKey = isP1 ? 'player1' : 'player2'
  const oppKey = isP1 ? 'player2' : 'player1'
  const me = isP1 ? player1 : player2
  const opp = isP1 ? player2 : player1

  const moveKeys = isP1 ? { left: 'a', right: 'd' } : { left: 'j', right: 'l' }
  const actionKeys = isP1 ? ['g', 'G'] : ["'", '5']

  const myChar = CHARACTERS.find((c) => c.id === me.avatarKey) ?? CHARACTERS[0]
  const oppChar = CHARACTERS.find((c) => c.id === opp.avatarKey) ?? CHARACTERS[1]
  const myName = me.name || (isP1 ? 'Player 1' : 'Player 2')
  const oppName = opp.name || (isP1 ? 'Player 2' : 'Player 1')

  const setPhase = useGameStore((s) => s.setPhase)

  // reactive HUD state
  const winner = useBowlingStore((s) => s.winner)
  const myState = useBowlingStore((s) => s[myKey])
  const oppTotal = useBowlingStore((s) => s[oppKey].total)
  const oppFinished = useBowlingStore((s) => s[oppKey].finished)
  const currentRound = useBowlingStore((s) => s.round)

  const [countdown, setCountdown] = useState(5)
  const countdownRef = useRef(countdown)
  useEffect(() => { countdownRef.current = countdown }, [countdown])
  useEffect(() => { setCountdown(5) }, [currentRound])
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  useEffect(() => {
    const store = useBowlingStore.getState()
    store.mount()

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    let L = computeLayout(canvas.width, canvas.height)

    // ── local (per-canvas) simulation state ──
    const local = {
      phase: 'aim', // aim | power | spin | rolling | result | done
      ball: freshBall(L),
      pins: makePins(L),
      power: 0,
      spin: 0,
      meterPhase: 0,
      standingBefore: PINS,
      knocked: 0,
      result: null, // { knocked, isStrike, isSpare }
      resultTimer: 0,
      rollFrames: 0,
      submitted: false,
      seenRound: store.round,
      seenCursor: `${store.player1.currentFrame}-${store.player1.rollInFrame}`,
      prevAction: false,
    }

    const standingCount = () => local.pins.filter((p) => p.state === 'standing').length

    const resetForRoll = (fullReset) => {
      if (fullReset) {
        local.pins = makePins(L)
      } else {
        // second ball of a frame: clear knocked pins, keep the standing ones
        local.pins = local.pins.filter((p) => p.state === 'standing')
      }
      local.ball = freshBall(L)
      local.phase = 'aim'
      local.power = 0
      local.spin = 0
      local.meterPhase = 0
      local.standingBefore = standingCount()
      local.submitted = false
      local.result = null
      local.rollFrames = 0
    }

    const throwBall = () => {
      const speed = L.laneLen * (0.012 + local.power * 0.012) // power → launch speed
      local.ball.vy = -speed
      local.ball.vx = 0
      local.ball.throwSpeed = speed
      local.ball.spin = local.spin
      local.phase = 'rolling'
      local.rollFrames = 0
    }

    const stepPhysics = () => {
      const b = local.ball
      const inGutter = b.x < L.laneLeft || b.x > L.laneRight
      const eps = L.laneLen * 0.0008
      const fallSpeed = L.laneLen * 0.0016

      for (let s = 0; s < SUBSTEPS; s++) {
        // hook: lateral acceleration grows as the ball slows (late break)
        if (!b.gone && !inGutter) {
          const sp = Math.hypot(b.vx, b.vy)
          const slow = Math.max(0, 1 - sp / b.throwSpeed)
          b.vx += (b.spin * L.laneW * CURVE_ACC * (0.35 + slow)) / SUBSTEPS
        }
        b.x += b.vx / SUBSTEPS
        b.y += b.vy / SUBSTEPS

        // gutter capture — slide to the channel centre, no more pin contact
        if (b.x < L.laneLeft - L.ballR) b.x = L.laneLeft - L.gutterW / 2
        if (b.x > L.laneRight + L.ballR) b.x = L.laneRight + L.gutterW / 2

        const ballHittable = !b.gone && !inGutter
        b.r = L.ballR

        // ball ↔ pins
        if (ballHittable) {
          for (const p of local.pins) {
            if (p.state === 'down') continue
            p.r = L.pinR
            resolveCircle(b, p, BALL_MASS, PIN_MASS, REST_BALL_PIN)
          }
        }

        // pin ↔ pin
        for (let i = 0; i < local.pins.length; i++) {
          const a = local.pins[i]
          if (a.state === 'down') continue
          a.r = L.pinR
          for (let j = i + 1; j < local.pins.length; j++) {
            const c = local.pins[j]
            if (c.state === 'down') continue
            c.r = L.pinR
            resolveCircle(a, c, PIN_MASS, PIN_MASS, REST_PIN_PIN)
          }
        }
      }

      // friction + knock-down state, once per frame
      b.vx *= BALL_FR
      b.vy *= BALL_FR
      if (b.y < L.top - L.ballR) b.gone = true
      if (Math.hypot(b.vx, b.vy) < eps) {
        b.vx = 0
        b.vy = 0
      }

      for (const p of local.pins) {
        p.vx *= PIN_FR
        p.vy *= PIN_FR
        const sp = Math.hypot(p.vx, p.vy)
        const disp = Math.hypot(p.x - p.homeX, p.y - p.homeY)
        if (p.state === 'standing' && (sp > fallSpeed || disp > L.pinR * 1.1)) {
          p.state = 'falling'
          p.fallDir = Math.atan2(p.vy, p.vx)
        }
        if (p.state === 'falling') {
          p.fallProg = Math.min(1, p.fallProg + 0.06)
          if (sp < eps && p.fallProg >= 1) p.state = 'down'
        }
      }

      // settle detection
      const maxPinSp = local.pins.reduce((m, p) => Math.max(m, Math.hypot(p.vx, p.vy)), 0)
      const ballActive = !b.gone && Math.hypot(b.vx, b.vy) > eps && b.y > L.top
      local.rollFrames++
      const calm = !ballActive && maxPinSp < eps
      if (calm || local.rollFrames > MAX_ROLL_FRAMES) {
        finishRoll()
      }
    }

    const finishRoll = () => {
      const standingNow = standingCount()
      local.knocked = Math.max(0, local.standingBefore - standingNow)
      const cur = useBowlingStore.getState()[myKey]
      local.result = {
        knocked: local.knocked,
        isStrike: cur.rollInFrame === 0 && local.knocked === PINS,
        isSpare: cur.rollInFrame === 1 && standingNow === 0,
        gutter: local.knocked === 0,
      }
      local.phase = 'result'
      local.resultTimer = RESULT_HOLD
    }

    const isActionDown = () => actionKeys.some((k) => pressedKeys.has(k))

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)

      // keep layout in sync with size
      if (canvas.clientWidth !== canvas.width || canvas.clientHeight !== canvas.height) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
        L = computeLayout(canvas.width, canvas.height)
      }

      const s = useBowlingStore.getState()
      const pd = s[myKey]

      // full reinitialise on restart
      if (s.round !== local.seenRound) {
        local.seenRound = s.round
        local.seenCursor = `${pd.currentFrame}-${pd.rollInFrame}`
        resetForRoll(true)
      }

      // store advanced our cursor → set up the next ball
      const cursor = `${pd.currentFrame}-${pd.rollInFrame}`
      if (cursor !== local.seenCursor) {
        local.seenCursor = cursor
        if (!pd.finished) resetForRoll(pd.rollInFrame === 0)
        else local.phase = 'done'
      }

      const action = isActionDown()
      const actionEdge = action && !local.prevAction

      // ── win overlay: action restarts the match ──
      if (s.winner) {
        if (actionEdge) useBowlingStore.getState().restartGame()
        local.prevAction = action
        render(s)
        return
      }

      if (!pd.finished && countdownRef.current === 0) {
        if (local.phase === 'aim') {
          if (pressedKeys.has(moveKeys.left)) local.ball.x -= L.laneW * AIM_SPEED
          if (pressedKeys.has(moveKeys.right)) local.ball.x += L.laneW * AIM_SPEED
          local.ball.x = Math.max(L.laneLeft + L.ballR, Math.min(L.laneRight - L.ballR, local.ball.x))
          if (actionEdge) {
            local.phase = 'power'
            local.meterPhase = 0
          }
        } else if (local.phase === 'power') {
          local.meterPhase += POWER_SPEED
          local.power = (Math.sin(local.meterPhase) + 1) / 2
          if (actionEdge) {
            local.phase = 'spin'
            local.meterPhase = 0
          }
        } else if (local.phase === 'spin') {
          local.meterPhase += SPIN_SPEED
          local.spin = Math.sin(local.meterPhase)
          if (actionEdge) throwBall()
        } else if (local.phase === 'rolling') {
          stepPhysics()
        } else if (local.phase === 'result') {
          local.resultTimer--
          if (local.resultTimer <= 0 && !local.submitted) {
            local.submitted = true
            useBowlingStore.getState().submitRoll(myKey, local.knocked)
          }
        }
      }

      local.prevAction = action
      render(s)
    }

    const render = (s) => {
      ctx.clearRect(0, 0, L.W, L.H)

      // ambient backdrop tinted with the player's colour
      const bg = ctx.createLinearGradient(0, 0, 0, L.H)
      bg.addColorStop(0, '#0e0c14')
      bg.addColorStop(1, '#1b1726')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, L.W, L.H)
      const glow = ctx.createRadialGradient(L.cx, L.H * 0.3, 0, L.cx, L.H * 0.3, L.W * 0.7)
      glow.addColorStop(0, myChar.glow.replace('0.35', '0.18'))
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, L.W, L.H)

      drawLane(ctx, L)

      // pins (draw fallen first so standing pins sit on top)
      for (const p of local.pins) if (p.state !== 'standing') drawPin(ctx, p, L)
      for (const p of local.pins) if (p.state === 'standing') drawPin(ctx, p, L)

      const pd = s[myKey]
      if (!pd.finished && !s.winner) {
        if (local.phase === 'aim') drawGuide(ctx, local.ball, L, 0)
        if (local.phase === 'spin') drawGuide(ctx, local.ball, L, local.spin)
        if (local.phase !== 'done') drawBall(ctx, local.ball, myChar.color, L)
        if (local.phase === 'power') drawPowerMeter(ctx, L, local.power)
        if (local.phase === 'spin') {
          drawPowerMeter(ctx, L, local.power)
          drawSpinMeter(ctx, L, local.spin)
        }
        if (local.phase === 'rolling') drawBall(ctx, local.ball, myChar.color, L)
      }

      // roll result banner
      if (local.phase === 'result' && local.result) {
        const r = local.result
        const label = r.isStrike ? 'STRIKE!' : r.isSpare ? 'SPARE!' : r.gutter ? 'GUTTER' : `${r.knocked} PIN${r.knocked === 1 ? '' : 'S'}`
        const col = r.isStrike ? '#f1c40f' : r.isSpare ? '#2ecc71' : r.gutter ? '#888' : '#fff'
        ctx.save()
        ctx.textAlign = 'center'
        ctx.font = '800 34px "Plus Jakarta Sans", sans-serif'
        ctx.fillStyle = col
        ctx.shadowColor = col
        ctx.shadowBlur = 18
        ctx.fillText(label, L.cx, L.H * 0.42)
        ctx.restore()
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      useBowlingStore.getState().unmount()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── HUD frame strip ──
  const frameCells = []
  for (let f = 0; f < FRAMES; f++) {
    const fr = myState.frames[f]
    let a = '', b = ''
    if (fr) {
      const [r0, r1] = fr.rolls
      if (r0 === 10) {
        a = ''
        b = 'X'
      } else {
        a = r0 === 0 ? '–' : r0 != null ? String(r0) : ''
        if (r1 != null) b = r0 + r1 === 10 ? '/' : r1 === 0 ? '–' : String(r1)
      }
    }
    frameCells.push({ a, b, active: f === myState.currentFrame && !myState.finished })
  }

  const leading =
    myState.total > oppTotal ? 'lead' : myState.total < oppTotal ? 'trail' : 'tie'

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#0e0c14' }}>
      {/* HUD */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center px-3 gap-3"
        style={{
          height: HUD_H,
          background: 'rgba(20,18,28,0.92)',
          backdropFilter: 'blur(6px)',
          borderBottom: `2px solid ${myChar.color}55`,
        }}
      >
        {/* name + score */}
        <div className="flex flex-col shrink-0">
          <span style={{ color: myChar.color, fontWeight: 800, fontSize: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {myName}
          </span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 20, lineHeight: 1, fontFamily: "'Space Grotesk', sans-serif" }}>
            {myState.total}
          </span>
        </div>

        {/* frame strip */}
        <div className="flex-1 flex items-center justify-center gap-1">
          {frameCells.map((c, i) => (
            <div
              key={i}
              style={{
                width: 30,
                borderRadius: 5,
                overflow: 'hidden',
                border: c.active ? `2px solid ${myChar.color}` : '1px solid rgba(255,255,255,0.14)',
                boxShadow: c.active ? `0 0 8px ${myChar.glow}` : 'none',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              <div style={{ textAlign: 'center', fontSize: 8, color: 'rgba(255,255,255,0.4)', padding: '1px 0' }}>{i + 1}</div>
              <div className="flex" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#fff', borderRight: '1px solid rgba(255,255,255,0.12)' }}>{c.a || ' '}</span>
                <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: c.b === 'X' ? '#f1c40f' : c.b === '/' ? '#2ecc71' : '#fff' }}>{c.b || ' '}</span>
              </div>
            </div>
          ))}
        </div>

        {/* opponent score */}
        <div className="flex flex-col items-end shrink-0">
          <span style={{ color: oppChar.color, fontWeight: 700, fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {oppName} {oppFinished ? '✓' : ''}
          </span>
          <span
            style={{
              color: leading === 'lead' ? '#2ecc71' : leading === 'trail' ? '#e74c3c' : 'rgba(255,255,255,0.7)',
              fontWeight: 800,
              fontSize: 16,
              lineHeight: 1,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {oppTotal}
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* controls hint */}
      {!winner && !myState.finished && countdown === 0 && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full"
          style={{ background: 'rgba(20,18,28,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: '0.08em', fontFamily: "'Space Grotesk', sans-serif" }}>
            {isP1 ? 'A / D aim · G to set power, spin & throw' : "J / L aim · ' to set power, spin & throw"}
          </span>
        </div>
      )}

      {/* countdown overlay */}
      {countdown > 0 && !winner && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div
            key={countdown}
            className="text-white font-extrabold animate-pop-in"
            style={{ fontSize: 120, fontFamily: "'Plus Jakarta Sans', sans-serif", textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* finished-but-waiting */}
      {myState.finished && !winner && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center" style={{ background: 'rgba(14,12,20,0.82)', backdropFilter: 'blur(4px)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 56, color: myChar.color }}>hourglass_top</span>
          <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginTop: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Final: {myState.total}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif" }}>
            Waiting for {oppName}…
          </div>
        </div>
      )}

      {/* end credits — both players have finished */}
      {winner && (
        <EndCredits
          title="Bowling"
          outcome={winner === 'tie' ? 'tie' : winner === myKey ? 'win' : 'lose'}
          isPlayer1={isP1}
          valueLabel="Total"
          myChar={myChar}
          myName={myName}
          myValue={myState.total}
          oppChar={oppChar}
          oppName={oppName}
          oppValue={oppTotal}
          playAgainKey={isP1 ? 'G' : "'"}
          onPlayAgain={() => useBowlingStore.getState().restartGame()}
          onBackToSelect={() => setPhase('CHARACTER_SELECT')}
        />
      )}
    </div>
  )
}
