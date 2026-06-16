import { useEffect, useRef } from 'react'
import { CHARACTERS } from '../../components/landing_page/CharacterSelect'
import useGameStore from '../../store/useGameStore'
import EndCredits from '../../components/EndCredits'
import useDuckStore, { MATCH_SECONDS } from './useDuckStore'
import { pickDuckType, DUCK_TYPES } from './ducks'

import duckUpImgSrc from '../parkour/assets/ducks/mallard_up.svg'
import duckDownImgSrc from '../parkour/assets/ducks/mallard_down.svg'

const HUD_H = 64

// ─── tuning ─────────────────────────────────────────────────────────────────
const MAX_DUCKS = 7
const SPAWN_START = 0.9 // seconds between surfacings (early match)
const SPAWN_END = 0.42 // … late match (busier)
const RISE_TIME = 0.45 // seconds to emerge from / sink under the water
const SWIM_MIN = 2.2 // seconds a duck stays surfaced before diving
const SWIM_MAX = 4.0
const HITTABLE_AT = 0.45 // surfaceT above which a duck can be shot

// Per-player aim + shoot keys. Aim is held (continuous); shoot is edge-triggered.
const P1_KEYS = { left: 'a', right: 'd', up: 'w', down: 's', shoot: 'g' }
const P2_KEYS = { left: 'j', right: 'l', up: 'i', down: 'k', shoot: "'" }

// ─── helpers ──────────────────────────────────────────────────────────────────
function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function held(pressedKeys, key) {
  return pressedKeys.has(key) || pressedKeys.has(key.toUpperCase())
}

function computeLayout(W, H) {
  const horizonY = HUD_H + (H - HUD_H) * 0.28 // water starts here, ducks farthest
  const bottomY = H - (H - HUD_H) * 0.06 // nearest ducks sit just above the rim
  const baseSize = Math.min(W, H) * 0.085 // mid-depth duck body size
  return { W, H, horizonY, bottomY, baseSize }
}

// World-space position + scale of a duck given its depth lane.
function duckMetrics(L, duck) {
  const baseY = lerp(L.horizonY, L.bottomY, duck.z)
  const size = L.baseSize * duck.type.sizeMult * lerp(0.62, 1.3, duck.z)
  const x = duck.x * L.W
  return { baseY, size, x }
}

// ─── component ────────────────────────────────────────────────────────────────
export default function DuckPondGame({ canvasId, player1, player2, pressedKeys }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const isP1 = canvasId === 'canvas-left'
  const myKey = isP1 ? 'player1' : 'player2'
  const me = isP1 ? player1 : player2
  const opp = isP1 ? player2 : player1
  const keys = isP1 ? P1_KEYS : P2_KEYS

  const myChar = CHARACTERS.find((c) => c.id === me.avatarKey) ?? CHARACTERS[0]
  const oppChar = CHARACTERS.find((c) => c.id === opp.avatarKey) ?? CHARACTERS[1]
  const myName = me.name || (isP1 ? 'Player 1' : 'Player 2')
  const oppName = opp.name || (isP1 ? 'Player 2' : 'Player 1')

  const setPhase = useGameStore((s) => s.setPhase)

  // reactive HUD state (gameplay stats are drawn on the canvas)
  const winner = useDuckStore((s) => s.winner)
  const timeLeft = useDuckStore((s) => s.timeLeft)
  const myScore = useDuckStore((s) => s[myKey].score)

  useEffect(() => {
    const store = useDuckStore.getState()
    store.mount()
    store.init()

    const loadedImages = {}
    DUCK_TYPES.forEach((type) => {
      const img = new Image()
      img.src = type.imageSrc
      loadedImages[type.id] = img
    })

    const flyingDuckImages = {
      up: new Image(),
      down: new Image()
    }
    flyingDuckImages.up.src = duckUpImgSrc
    flyingDuckImages.down.src = duckDownImgSrc

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    let L = computeLayout(canvas.width, canvas.height)

    // ── local (per-canvas) state ──
    const local = {
      ducks: [], // { type, z, x, dir, vx, phase, t, swimDur, surfaceT, bobPhase, hit }
      flyingDucks: [], // { z, x, y, dir, vx, vy, t, phaseOffset, hit, points, isFlying, body }
      particles: [], // { x, y, vx, vy, life, max, r, color }
      floaters: [], // { x, y, text, color, life, max }
      cross: { x: canvas.width / 2, y: (L.horizonY + L.bottomY) / 2 },
      spawnTimer: 0.6,
      flash: 0, // crosshair pulse on shoot
      ripple: 0, // pond shimmer phase
      lastT: performance.now(),
      goFlash: 0,
      countingDown: true,
      seenRound: store.round,
      prevShoot: false,
    }

    const resetLocal = () => {
      local.ducks.length = 0
      local.flyingDucks.length = 0
      local.particles.length = 0
      local.floaters.length = 0
      local.cross = { x: L.W / 2, y: (L.horizonY + L.bottomY) / 2 }
      local.spawnTimer = 0.6
      local.flash = 0
      local.goFlash = 0
      local.countingDown = true
    }

    const burst = (x, y, color, n, power) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = power * (0.4 + Math.random() * 0.9)
        local.particles.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - power * 0.5,
          life: 1, max: 0.4 + Math.random() * 0.4,
          r: L.baseSize * (0.05 + Math.random() * 0.08),
          color,
        })
      }
    }

    const floater = (x, y, text, color) => {
      local.floaters.push({ x, y, text, color, life: 1, max: 0.8 })
    }

    const spawnDuck = () => {
      if (local.ducks.length >= MAX_DUCKS) return
      const type = pickDuckType()
      const dir = Math.random() < 0.5 ? 1 : -1
      local.ducks.push({
        type,
        z: 0.08 + Math.random() * 0.86, // depth lane
        x: 0.14 + Math.random() * 0.72, // surface somewhere across the pond
        dir,
        vx: type.baseSpeed * dir, // pond-fractions per second
        phase: 'rising',
        t: 0,
        swimDur: SWIM_MIN + Math.random() * (SWIM_MAX - SWIM_MIN),
        surfaceT: 0,
        bobPhase: Math.random() * Math.PI * 2,
        hit: false,
      })
    }

    const spawnFlyingDuck = () => {
      if (local.flyingDucks.length >= 4) return
      const dir = Math.random() < 0.5 ? 1 : -1
      local.flyingDucks.push({
        z: 0.3 + Math.random() * 0.6,
        x: dir === 1 ? -0.2 : 1.2,
        y: 0.1 + Math.random() * 0.7, // Normalized Y in the sky region
        dir,
        vx: dir * (0.3 + Math.random() * 0.3), // pond-fractions per second
        vy: (Math.random() - 0.5) * 0.1,
        t: 0,
        phaseOffset: Math.random() * Math.PI * 2,
        hit: false,
        points: 40,
        isFlying: true,
        body: '#1f6f50'
      })
    }

    const spawnInterval = (progress) => lerp(SPAWN_START, SPAWN_END, progress)

    // Closest surfaced duck under the crosshair, or null.
    const pickTarget = () => {
      let best = null
      let bestDist = Infinity
      for (const duck of local.ducks) {
        if (duck.hit || duck.surfaceT < HITTABLE_AT) continue
        const m = duckMetrics(L, duck)
        const cy = m.baseY - m.size * 0.35
        const dx = local.cross.x - m.x
        const dy = local.cross.y - cy
        const dist = Math.hypot(dx, dy)
        const radius = m.size * 0.7
        if (dist <= radius && dist < bestDist) {
          bestDist = dist
          best = duck
        }
      }

      for (const fduck of local.flyingDucks) {
        if (fduck.hit) continue
        const cy = HUD_H + fduck.y * (L.horizonY - HUD_H)
        const cx = fduck.x * L.W
        const size = L.baseSize * 1.5 * fduck.z
        const dx = local.cross.x - cx
        const dy = local.cross.y - cy
        const dist = Math.hypot(dx, dy)
        const radius = size * 0.6
        if (dist <= radius && dist < bestDist) {
          bestDist = dist
          best = fduck
        }
      }

      return best
    }

    const shoot = () => {
      local.flash = 1
      const target = pickTarget()
      if (target) {
        target.hit = true
        if (target.isFlying) {
          const cx = target.x * L.W
          const cy = HUD_H + target.y * (L.horizonY - HUD_H)
          useDuckStore.getState().registerHit(myKey, target.points)
          burst(cx, cy, target.body, 14, 4.6)
          floater(cx, cy - 20, `+${target.points}`, '#ffffff')
        } else {
          target.phase = 'diving'
          target.t = 0
          const m = duckMetrics(L, target)
          const cy = m.baseY - m.size * 0.35
          const pts = target.type.points
          useDuckStore.getState().registerHit(myKey, pts)
          burst(m.x, cy, target.type.body, 14, 4.6)
          burst(m.x, m.baseY, '#bfe3f5', 8, 3) // water splash
          floater(m.x, cy - m.size * 0.4, `+${pts}`, target.type.glow ? '#ffd23f' : '#ffffff')
        }
      } else {
        useDuckStore.getState().registerMiss(myKey)
        burst(local.cross.x, local.cross.y, 'rgba(190,225,245,0.9)', 6, 2.4)
      }
    }

    // ── drawing ──────────────────────────────────────────────────────────────
    const drawScene = (now) => {
      // sky
      const sky = ctx.createLinearGradient(0, HUD_H, 0, L.horizonY)
      sky.addColorStop(0, '#ff7e5f')
      sky.addColorStop(1, '#feb47b')
      ctx.fillStyle = sky
      ctx.fillRect(0, HUD_H, L.W, L.horizonY - HUD_H)

      // sun/moon glow tinted by this player's colour, low on the horizon
      const glow = ctx.createRadialGradient(L.W * 0.5, L.horizonY, 0, L.W * 0.5, L.horizonY, L.W * 0.55)
      glow.addColorStop(0, myChar.color + '88')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, HUD_H, L.W, L.horizonY - HUD_H)

      // water (lighter at the horizon, deeper toward the player → depth cue)
      const water = ctx.createLinearGradient(0, L.horizonY, 0, L.H)
      water.addColorStop(0, '#d8705c')
      water.addColorStop(1, '#213554')
      ctx.fillStyle = water
      ctx.fillRect(0, L.horizonY, L.W, L.H - L.horizonY)

      // ripple bands — closer bands are taller/brighter (perspective)
      for (let i = 0; i < 7; i++) {
        const f = i / 6
        const y = lerp(L.horizonY + 6, L.H - 4, f)
        const a = 0.04 + f * 0.06 + Math.sin(now * 0.0014 + i) * 0.015
        ctx.strokeStyle = `rgba(190,225,245,${Math.max(0, a)})`
        ctx.lineWidth = 1 + f * 1.6
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(L.W, y)
        ctx.stroke()
      }
    }

    const drawDuck = (duck, now) => {
      const m = duckMetrics(L, duck)
      const size = m.size
      const bob = Math.sin(now * 0.004 + duck.bobPhase) * size * 0.05
      const waterY = m.baseY + bob
      const bodyCy = waterY - size * 0.32
      // emerge / submerge by sliding the duck up from under a clip at the waterline
      const hidden = (1 - duck.surfaceT) * size * 1.6

      ctx.save()
      // clip so the part still "underwater" is hidden
      ctx.beginPath()
      ctx.rect(0, HUD_H, L.W, waterY + size * 0.18 - HUD_H)
      ctx.clip()
      ctx.translate(m.x, bodyCy + hidden)
      ctx.scale(duck.dir, 1) // face travel direction

      if (duck.type.glow) {
        ctx.shadowColor = '#ffd23f'
        ctx.shadowBlur = 16
      }

      const img = loadedImages[duck.type.id]
      if (img && img.complete) {
        const imgW = size * 1.8
        const imgH = size * 1.2
        ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH)
      } else {
        // Fallback or waiting to load
        ctx.fillStyle = duck.type.body
        ctx.beginPath()
        ctx.ellipse(0, 0, size * 0.62, size * 0.42, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.shadowBlur = 0
      ctx.restore()

      // waterline ripple ring around the duck (drawn over the water, not clipped)
      ctx.save()
      ctx.globalAlpha = 0.4 * duck.surfaceT
      ctx.strokeStyle = 'rgba(200,235,250,0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(m.x, waterY + size * 0.16, size * 0.6, size * 0.16, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    const drawFlyingDucks = (now) => {
      for (const d of local.flyingDucks) {
        const cx = d.x * L.W
        const cy = HUD_H + d.y * (L.horizonY - HUD_H)
        const flap = Math.sin(d.t * 12 + d.phaseOffset)
        const activeImage = flap > 0 ? flyingDuckImages.up : flyingDuckImages.down
        
        if (activeImage.complete && activeImage.naturalWidth > 0) {
          ctx.save()
          const size = L.baseSize * 1.5 * d.z
          const bob = Math.cos(d.t * 3 + d.phaseOffset) * 15 * d.z
          ctx.translate(cx, cy + bob)
          ctx.scale(d.dir > 0 ? 1 : -1, 1)
          
          const dw = size * 1.5
          const dh = size * 1.0
          ctx.drawImage(activeImage, -dw / 2, -dh / 2, dw, dh)
          ctx.restore()
        }
      }
    }

    const drawParticles = () => {
      for (const p of local.particles) {
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const drawFloaters = () => {
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const f of local.floaters) {
        ctx.globalAlpha = Math.max(0, f.life)
        ctx.fillStyle = f.color
        ctx.font = '800 22px "Plus Jakarta Sans", sans-serif'
        ctx.fillText(f.text, f.x, f.y)
      }
      ctx.globalAlpha = 1
    }

    const drawCrosshair = () => {
      const { x, y } = local.cross
      const r = L.baseSize * 0.55 * (1 + local.flash * 0.25)
      ctx.save()
      ctx.translate(x, y)
      ctx.strokeStyle = myChar.color
      ctx.shadowColor = myChar.glow
      ctx.shadowBlur = 12
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2)
      ctx.globalAlpha = 0.5
      ctx.stroke()
      ctx.globalAlpha = 1
      // tick marks
      ctx.beginPath()
      ctx.moveTo(-r * 1.35, 0)
      ctx.lineTo(-r * 0.5, 0)
      ctx.moveTo(r * 0.5, 0)
      ctx.lineTo(r * 1.35, 0)
      ctx.moveTo(0, -r * 1.35)
      ctx.lineTo(0, -r * 0.5)
      ctx.moveTo(0, r * 0.5)
      ctx.lineTo(0, r * 1.35)
      ctx.stroke()
      // centre dot
      ctx.shadowBlur = 0
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const drawCountdown = (startTime) => {
      const remain = startTime - Date.now()
      const n = Math.ceil(remain / 1000)
      const sub = (remain % 1000) / 1000
      const scale = 0.7 + sub * 0.6
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = Math.min(1, sub * 1.6)
      ctx.fillStyle = myChar.color
      ctx.shadowColor = myChar.glow
      ctx.shadowBlur = 30
      ctx.font = `900 ${Math.round(120 * scale)}px "Plus Jakarta Sans", sans-serif`
      ctx.fillText(String(n), L.W / 2, (L.horizonY + L.bottomY) / 2)
      ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '700 13px "Space Grotesk", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('TAKE AIM', L.W / 2, (L.horizonY + L.bottomY) / 2 + 80)
    }

    const drawGo = () => {
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.globalAlpha = Math.min(1, local.goFlash)
      const scale = 1 + (1 - local.goFlash) * 0.6
      ctx.translate(L.W / 2, (L.horizonY + L.bottomY) / 2)
      ctx.scale(scale, scale)
      ctx.fillStyle = '#fff'
      ctx.shadowColor = myChar.color
      ctx.shadowBlur = 30
      ctx.font = '900 96px "Plus Jakarta Sans", sans-serif'
      ctx.fillText('GO!', 0, 0)
      ctx.restore()
    }

    // ── main loop ──────────────────────────────────────────────────────────────
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)

      const now = performance.now()
      let dt = (now - local.lastT) / 1000
      local.lastT = now
      if (dt > 0.1) dt = 0.1 // clamp after tab-switch stalls

      if (canvas.clientWidth !== canvas.width || canvas.clientHeight !== canvas.height) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
        L = computeLayout(canvas.width, canvas.height)
      }

      const s = useDuckStore.getState()

      // restart wipes the local pond
      if (s.round !== local.seenRound) {
        local.seenRound = s.round
        resetLocal()
      }

      useDuckStore.getState().tickClock()

      const startTime = s.startTime
      const counting = Date.now() < startTime
      if (local.countingDown && !counting) {
        local.countingDown = false
        local.goFlash = 1
      }
      const progress = 1 - Math.max(0, s.timeLeft) / MATCH_SECONDS
      const playing = !counting && !s.winner

      // ── crosshair movement (held keys) ──
      if (playing) {
        const speed = L.H * 0.85 * dt
        if (held(pressedKeys, keys.left)) local.cross.x -= speed
        if (held(pressedKeys, keys.right)) local.cross.x += speed
        if (held(pressedKeys, keys.up)) local.cross.y -= speed
        if (held(pressedKeys, keys.down)) local.cross.y += speed
        local.cross.x = clamp(local.cross.x, 10, L.W - 10)
        local.cross.y = clamp(local.cross.y, HUD_H + 10, L.H - 10)

        // ── shoot (edge-triggered) ──
        const sdown = held(pressedKeys, keys.shoot)
        if (sdown && !local.prevShoot) shoot()
        local.prevShoot = sdown
      } else {
        local.prevShoot = held(pressedKeys, keys.shoot)
      }

      // restart from the win overlay (same key doubles as "play again")
      if (s.winner) {
        const sdown = held(pressedKeys, keys.shoot)
        if (sdown && !local.prevShoot) useDuckStore.getState().restart()
        local.prevShoot = sdown
      }

      // ── spawn + advance ducks ──
      if (playing) {
        local.spawnTimer -= dt
        if (local.spawnTimer <= 0) {
          spawnDuck()
          local.spawnTimer = spawnInterval(progress) * (0.8 + Math.random() * 0.4)
        }
        if (Math.random() < dt * 0.8) {
          spawnFlyingDuck()
        }
      }

      for (const fduck of local.flyingDucks) {
        fduck.t += dt
        fduck.x += fduck.vx * dt
        fduck.y += fduck.vy * dt
      }
      local.flyingDucks = local.flyingDucks.filter((d) => !d.hit && d.x > -0.3 && d.x < 1.3)

      for (const duck of local.ducks) {
        duck.t += dt
        if (duck.phase === 'rising') {
          duck.surfaceT = Math.min(1, duck.t / RISE_TIME)
          if (duck.surfaceT >= 1) {
            duck.phase = 'swimming'
            duck.t = 0
          }
        } else if (duck.phase === 'swimming') {
          duck.x += duck.vx * dt
          if (duck.t >= duck.swimDur || duck.x < 0.04 || duck.x > 0.96) {
            duck.phase = 'diving'
            duck.t = 0
          }
        } else if (duck.phase === 'diving') {
          duck.surfaceT = Math.max(0, 1 - duck.t / RISE_TIME)
          if (duck.surfaceT <= 0) duck.phase = 'dead'
        }
      }
      local.ducks = local.ducks.filter((d) => d.phase !== 'dead')

      // ── particles / floaters / juice ──
      for (const p of local.particles) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.22
        p.life -= dt / p.max
      }
      local.particles = local.particles.filter((p) => p.life > 0)
      for (const f of local.floaters) {
        f.y -= 34 * dt
        f.life -= dt / f.max
      }
      local.floaters = local.floaters.filter((f) => f.life > 0)
      local.flash = Math.max(0, local.flash - dt * 4)
      if (local.goFlash > 0) local.goFlash = Math.max(0, local.goFlash - dt * 1.6)

      // ── render ──
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, L.W, L.H)
      drawScene(now)

      drawFlyingDucks(now)

      // far → near so closer ducks overlap farther ones
      const ordered = [...local.ducks].sort((a, b) => a.z - b.z)
      for (const duck of ordered) drawDuck(duck, now)

      drawParticles()
      drawFloaters()

      if (counting) drawCountdown(startTime)
      else {
        if (local.goFlash > 0) drawGo()
        if (playing) drawCrosshair()
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      useDuckStore.getState().unmount()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── HUD clock formatting ──
  const mm = Math.floor(timeLeft / 60)
  const ss = String(timeLeft % 60).padStart(2, '0')
  const low = timeLeft <= 10 && !winner

  // win-overlay summary (read once; stable after the winner is set)
  const oppKey = isP1 ? 'player2' : 'player1'
  const myStats = useDuckStore.getState()[myKey]
  const oppStats = useDuckStore.getState()[oppKey]
  const accuracy = myStats.shots > 0 ? Math.round((myStats.hits / myStats.shots) * 100) : 0

  const aimHint = `${keys.up}${keys.left}${keys.down}${keys.right}`.toUpperCase()
  const shootHint = keys.shoot.toUpperCase()

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#0c2438' }}>
      {/* HUD */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center px-3"
        style={{
          height: HUD_H,
          background: 'rgba(12,24,40,0.92)',
          backdropFilter: 'blur(6px)',
          borderBottom: `2px solid ${myChar.color}55`,
        }}
      >
        {/* me + score */}
        <div className="flex flex-col shrink-0" style={{ width: '32%' }}>
          <span style={{ color: myChar.color, fontWeight: 800, fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {myName} <span style={{ opacity: 0.6, fontSize: 10 }}>(YOU)</span>
          </span>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
            {myScore} <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: '0.16em' }}>PTS</span>
          </span>
        </div>

        {/* clock */}
        <div className="flex-1 flex flex-col items-center">
          <span
            style={{
              color: low ? '#ff5a5a' : '#fff',
              fontWeight: 800,
              fontSize: 26,
              lineHeight: 1,
              fontFamily: "'Space Grotesk', sans-serif",
              textShadow: low ? '0 0 14px rgba(255,90,90,0.7)' : 'none',
              transform: low ? `scale(${1 + (timeLeft % 2 === 0 ? 0.08 : 0)})` : 'none',
              transition: 'transform 0.15s',
            }}
          >
            {mm}:{ss}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, letterSpacing: '0.2em', fontFamily: "'Space Grotesk', sans-serif" }}>
            TIME LEFT
          </span>
        </div>

        {/* opponent */}
        <div className="flex flex-col items-end shrink-0" style={{ width: '32%' }}>
          <span style={{ color: oppChar.color, fontWeight: 700, fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {oppName}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}>
            RIVAL
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* controls hint */}
      {!winner && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full"
          style={{ background: 'rgba(12,24,40,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, letterSpacing: '0.08em', fontFamily: "'Space Grotesk', sans-serif" }}>
            {aimHint} to aim · {shootHint} to shoot · golden ducks pay the most
          </span>
        </div>
      )}

      {/* end credits — match resolved (time up) */}
      {winner && (
        <EndCredits
          title="Duck Pond"
          outcome={winner === 'tie' ? 'tie' : winner === myKey ? 'win' : 'lose'}
          isPlayer1={isP1}
          valueLabel="Ducks Caught"
          subtitle={`${myStats.hits} ducks · ${accuracy}% accuracy · best shot ${myStats.best} pts`}
          myChar={myChar}
          myName={myName}
          myValue={myStats.score}
          oppChar={oppChar}
          oppName={oppName}
          oppValue={oppStats.score}
          playAgainKey={isP1 ? 'G' : "'"}
          onPlayAgain={() => useDuckStore.getState().restart()}
          onBackToSelect={() => setPhase('CHARACTER_SELECT')}
        />
      )}
    </div>
  )
}
