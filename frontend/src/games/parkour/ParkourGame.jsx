import { useEffect, useRef, useState, useCallback } from 'react'
import useGameStore from '../../store/useGameStore'
import { CHARACTERS } from '../../components/landing_page/CharacterSelect'
import EndCredits from '../../components/EndCredits'
import useParkourStore, { STAGE_COUNT, STAGES_TO_WIN } from './useParkourStore'
import { STAGES, THEMES, WORLD_WIDTH } from './levels'

import p1Idle from './assets/player1/player1_idle.png'
import p1Walk1 from './assets/player1/player1_walk1.png'
import p1Walk2 from './assets/player1/player1_walk2.png'
import p1Jump from './assets/player1/player1_jump.png'

import p2Idle from './assets/player2/player2_idle.png'
import p2Walk1 from './assets/player2/player2_walk1.png'
import p2Walk2 from './assets/player2/player2_walk2.png'
import p2Jump from './assets/player2/player2_jump.png'

import platImgSrc from './assets/platforms/platform.png'
import cloudImgSrc from './assets/platforms/cloud.png'
import treeImgSrc from './assets/platforms/tree.png'
import groundImgSrc from './assets/ground/ground.png'

import bg1ImgSrc from './assets/bg1.png'
import bg2ImgSrc from './assets/bg2.png'
import bg3ImgSrc from './assets/bg3.png'

// ─── physics tuning (world units = px, time = seconds) ───────────────────────
const GRAVITY = 1500
const MOVE_SPEED = 230
const JUMP_V = -640 // initial jump velocity (apex ≈ 135px)
const TREE_BOUNCE_V = -900 // springy branch launch
const MAX_FALL = 1100
const SUBSTEPS = 4
const PLAYER_W = 30
const PLAYER_H = 34

// ─── cloud lifecycle (ms) ────────────────────────────────────────────────────
const CLOUD_FADE_MS = 600 // collidable grace period after you land
const CLOUD_RESPAWN_MS = 1400 // time spent gone before puffing back

// canvas-left drives Player 1, canvas-right drives Player 2.
const PANELS = {
  'canvas-left': {
    playerKey: 'player1',
    controls: { left: ['a'], right: ['d'], jump: ['w'] },
  },
  'canvas-right': {
    playerKey: 'player2',
    controls: { left: ['j', 'ArrowLeft'], right: ['l', 'ArrowRight'], jump: ['i', 'ArrowUp'] },
  },
}

function makeIsDown(pressedKeys) {
  return (key) =>
    pressedKeys.has(key) || pressedKeys.has(key.toUpperCase()) || pressedKeys.has(key.toLowerCase())
}

function spawnPlayer(stage, playerKey) {
  const s = playerKey === 'player1' ? stage.spawn.p1 : stage.spawn.p2
  return { x: s.x, y: s.y, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, onGround: false, facing: 1, walkTime: 0 }
}

// A cloud is collidable unless it has fully faded ('gone').
function isSolidNow(plat, idx, clouds) {
  if (plat.type !== 'cloud') return true
  const c = clouds[idx]
  return !c || c.phase !== 'gone'
}

function cloudOpacity(c, now) {
  if (!c) return 1
  if (c.phase === 'triggered') {
    const t = Math.min(1, (now - c.t0) / CLOUD_FADE_MS)
    return 1 - t * 0.6
  }
  return 0.18 // gone
}

// Advance the cloud state machine in place: triggered → gone → (solid again).
function updateClouds(clouds, now) {
  for (const idx of Object.keys(clouds)) {
    const c = clouds[idx]
    if (c.phase === 'triggered' && now - c.t0 >= CLOUD_FADE_MS) {
      clouds[idx] = { phase: 'gone', t0: now }
    } else if (c.phase === 'gone' && now - c.t0 >= CLOUD_RESPAWN_MS) {
      delete clouds[idx] // absent === solid
    }
  }
}

// Step one player through `dt` seconds against the live stage. Mutates `player`
// and `clouds` (both panel-local). Returns true once the player crests finishY.
function stepPlayer(player, dt, stage, clouds, isDown, controls, jumpPressed, now) {
  const moveDir =
    (controls.right.some(isDown) ? 1 : 0) - (controls.left.some(isDown) ? 1 : 0)
  player.vx = moveDir * MOVE_SPEED
  if (moveDir !== 0) {
    player.facing = moveDir
    player.walkTime += dt
  } else {
    player.walkTime = 0
  }

  if (jumpPressed && player.onGround) {
    player.vy = JUMP_V
    player.onGround = false
  }

  const sub = dt / SUBSTEPS
  for (let i = 0; i < SUBSTEPS; i++) {
    player.x = Math.max(0, Math.min(player.x + player.vx * sub, stage.worldWidth - player.w))

    const prevBottom = player.y + player.h
    player.vy = Math.min(player.vy + GRAVITY * sub, MAX_FALL)
    player.y += player.vy * sub
    player.onGround = false

    if (player.vy >= 0) {
      const newBottom = player.y + player.h
      for (let p = 0; p < stage.platforms.length; p++) {
        const plat = stage.platforms[p]
        if (!isSolidNow(plat, p, clouds)) continue
        const currentPlatX = plat.moving ? plat.x + Math.sin(now / 1000 + plat.y) * 40 : plat.x
        const overlapsX = player.x + player.w > currentPlatX && player.x < currentPlatX + plat.w
        const crossedTop = prevBottom <= plat.y && newBottom >= plat.y
        if (!overlapsX || !crossedTop) continue

        player.y = plat.y - player.h
        if (plat.type === 'tree') {
          player.vy = TREE_BOUNCE_V // launch, stay airborne
        } else {
          player.vy = 0
          player.onGround = true
          if (plat.type === 'cloud' && !clouds[p]) {
            clouds[p] = { phase: 'triggered', t0: performance.now() }
          }
        }
        break
      }
    }
  }

  return player.y < stage.finishY
}

// ─── rendering ───────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rr)
}

function drawPlatform(ctx, plat, theme, opacity, images, now) {
  ctx.save()
  ctx.globalAlpha = opacity
  const currentPlatX = plat.moving ? plat.x + Math.sin(now / 1000 + plat.y) * 40 : plat.x

  if (plat.type === 'ground') {
    const img = images.ground
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(currentPlatX, plat.y, plat.w, plat.h)
      ctx.clip()
      const aspect = img.naturalWidth / img.naturalHeight
      const drawW = plat.h * aspect
      for (let tx = 0; tx < plat.w; tx += drawW) {
        ctx.drawImage(img, currentPlatX + tx, plat.y, drawW + 1, plat.h)
      }
      ctx.restore()
    } else {
      ctx.fillStyle = '#000'
      roundRect(ctx, currentPlatX, plat.y, plat.w, plat.h, 4)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = '#aaa' // gray highlight
      ctx.shadowColor = '#aaa'
      ctx.shadowBlur = 8
      ctx.stroke()
    }
  } else {
    const img = images[plat.type]
    if (img && img.complete && img.naturalWidth > 0) {
      // Draw the custom asset. 
      // Adjust Y slightly so the physics landing plane (plat.y) visually aligns with the top of the sprite
      const drawH = 40
      let offsetY = -8
      if (plat.type === 'cloud') offsetY = -10
      if (plat.type === 'tree') offsetY = -12

      ctx.drawImage(img, currentPlatX, plat.y + offsetY, plat.w, drawH)
    } else {
      // Fallback primitives
      ctx.fillStyle = '#000'
      roundRect(ctx, currentPlatX, plat.y, plat.w, plat.h, 4)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = plat.type === 'tree' ? '#0f0' : plat.type === 'cloud' ? '#fff' : '#f0f'
      ctx.shadowColor = ctx.strokeStyle
      ctx.shadowBlur = 8
      ctx.stroke()
    }
  }

  ctx.restore()
}

function drawPlayer(ctx, player, color, images) {
  const { x, y, w, h, vy, onGround, facing, walkTime = 0 } = player
  // squash & stretch from vertical speed
  const stretch = Math.max(-0.18, Math.min(0.18, vy / 4000))
  const dw = w * (1 - stretch)
  const dh = h * (1 + stretch)
  const cx = x + w / 2
  const top = y + h - dh

  ctx.save()

  // Determine which state to draw
  let activeImage = null
  if (!onGround) {
    activeImage = images.jump
  } else if (Math.abs(player.vx) > 0) {
    // Alternate between the two walking frames
    const walkFrame = Math.floor(walkTime * 10) % 2
    activeImage = walkFrame === 0 ? images.walk1 : images.walk2
  } else {
    activeImage = images.idle
  }

  if (activeImage && activeImage.complete && activeImage.naturalWidth > 0) {
    ctx.translate(cx, 0)
    ctx.scale(facing, 1)

    // Make the sprite slightly larger than the collision box to look natural
    const spriteW = dw * 2
    const spriteH = dh * 1.5
    ctx.drawImage(activeImage, -spriteW / 2, top - dh * 0.4, spriteW, spriteH)
  } else {
    ctx.fillStyle = color
    roundRect(ctx, cx - dw / 2, top, dw, dh, dw / 2.4)
    ctx.fill()

    // eyes
    const eyeY = top + dh * 0.36
    const eyeDx = dw * 0.2
    const er = dw * 0.13
    for (const sign of [-1, 1]) {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(cx + sign * eyeDx, eyeY, er, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#1a1530'
      ctx.beginPath()
      ctx.arc(cx + sign * eyeDx + facing * er * 0.4, eyeY, er * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}

// ─── sprite assets ───────────────────────────────────────────────────────────
const platformImages = {
  platform: new Image(),
  cloud: new Image(),
  tree: new Image(),
  ground: new Image(),
  bg1: new Image(),
  bg2: new Image(),
  bg3: new Image(),
}
platformImages.platform.src = platImgSrc
platformImages.cloud.src = cloudImgSrc
platformImages.tree.src = treeImgSrc
platformImages.ground.src = groundImgSrc
platformImages.bg1.src = bg1ImgSrc
platformImages.bg2.src = bg2ImgSrc
platformImages.bg3.src = bg3ImgSrc

const p1Images = {
  idle: new Image(),
  walk1: new Image(),
  walk2: new Image(),
  jump: new Image(),
}
p1Images.idle.src = p1Idle
p1Images.walk1.src = p1Walk1
p1Images.walk2.src = p1Walk2
p1Images.jump.src = p1Jump

const p2Images = {
  idle: new Image(),
  walk1: new Image(),
  walk2: new Image(),
  jump: new Image(),
}
p2Images.idle.src = p2Idle
p2Images.walk1.src = p2Walk1
p2Images.walk2.src = p2Walk2
p2Images.jump.src = p2Jump

export default function ParkourGame({ canvasId, player1, player2, pressedKeys }) {
  const panel = PANELS[canvasId]
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const playerRef = useRef(null)
  const cloudsRef = useRef({})
  const reportedRef = useRef(false)
  const seenRoundRef = useRef(0)
  const seenStageRef = useRef(0)
  const prevJumpRef = useRef(false)
  const lastTRef = useRef(0)
  const countingDownRef = useRef(true)
  const goFlashRef = useRef(0)

  const [isOver, setIsOver] = useState(false)
  const setPhase = useGameStore((s) => s.setPhase)

  const handlePlayAgain = useCallback(() => {
    useParkourStore.getState().restart()
    setIsOver(false)
  }, [])
  const handleBackToSelect = useCallback(() => setPhase('CHARACTER_SELECT'), [setPhase])

  useEffect(() => {
    if (!panel) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { playerKey, controls } = panel
    const isDown = makeIsDown(pressedKeys)

    const store = useParkourStore.getState()
    store.mount()
    store.init()

    // Local reset to a stage's starting line.
    const resetToStage = (stageIdx) => {
      const stage = STAGES[stageIdx]
      playerRef.current = spawnPlayer(stage, playerKey)
      cloudsRef.current = {}
      reportedRef.current = false
      seenStageRef.current = stageIdx
    }
    resetToStage(useParkourStore.getState().stageIndex)
    seenRoundRef.current = useParkourStore.getState().round
    lastTRef.current = performance.now()

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop)
      const now = performance.now()
      let dt = (now - lastTRef.current) / 1000
      lastTRef.current = now
      if (dt > 0.05) dt = 0.05 // clamp tab-switch stalls

      const snap = useParkourStore.getState()

      // React to restart (round bump) and stage advance from either panel.
      if (snap.round !== seenRoundRef.current) {
        seenRoundRef.current = snap.round
        resetToStage(snap.stageIndex)
        setIsOver(false)
        countingDownRef.current = true
        goFlashRef.current = 0
      } else if (snap.stageIndex !== seenStageRef.current) {
        resetToStage(snap.stageIndex)
      }

      useParkourStore.getState().tickClock()

      const counting = Date.now() < snap.startTime
      if (countingDownRef.current && !counting) {
        countingDownRef.current = false
        goFlashRef.current = 1
      }
      if (goFlashRef.current > 0) {
        goFlashRef.current = Math.max(0, goFlashRef.current - dt * 1.6)
      }

      const stage = STAGES[snap.stageIndex]
      const theme = THEMES[stage.theme]
      const player = playerRef.current
      const frozen = Boolean(snap.winner) || Boolean(snap.stageWinner) || counting

      // ── update ──
      const jumpDown = controls.jump.some(isDown)
      const jumpPressed = jumpDown && !prevJumpRef.current
      prevJumpRef.current = jumpDown

      updateClouds(cloudsRef.current, now)

      if (!frozen) {
        const topped = stepPlayer(
          player, dt, stage, cloudsRef.current, isDown, controls, jumpPressed, now,
        )
        if (topped && !reportedRef.current) {
          reportedRef.current = true
          useParkourStore.getState().reportStageTop(playerKey)
        }
      } else {
        useParkourStore.getState().advanceStageIfReady()
        if (snap.winner && !isOver) setIsOver(true)
      }

      // ── camera (vertical follow, uniform scale by width) ──
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.width / dpr
      const cssH = canvas.height / dpr
      const scale = cssW / WORLD_WIDTH
      const viewH = cssH / scale
      let camY = player.y + player.h / 2 - viewH / 2
      camY = Math.max(0, Math.min(camY, Math.max(0, stage.worldHeight - viewH)))

      // ── render ──
      const bgImg = platformImages[`bg${snap.stageIndex + 1}`]
      if (bgImg && bgImg.complete) {
        ctx.drawImage(bgImg, 0, 0, cssW, cssH)
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, cssH)
        grad.addColorStop(0, theme.skyTop)
        grad.addColorStop(1, theme.skyBottom)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, cssW, cssH)
      }

      ctx.save()
      ctx.scale(scale, scale)
      ctx.translate(0, -camY)

      // finish line
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillRect(0, stage.finishY, WORLD_WIDTH, 4)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('FINISH', WORLD_WIDTH / 2, stage.finishY - 12)

      for (let p = 0; p < stage.platforms.length; p++) {
        const plat = stage.platforms[p]
        if (plat.y - camY > viewH + 40 || plat.y - camY < -120) continue // cull
        const op = plat.type === 'cloud' ? cloudOpacity(cloudsRef.current[p], now) : 1
        drawPlatform(ctx, plat, theme, op, platformImages, now)
      }

      const me = playerKey === 'player1' ? player1 : player2
      const myChar = CHARACTERS.find((c) => c.id === me?.avatarKey) ?? CHARACTERS[0]
      const imagesToUse = playerKey === 'player1' ? p1Images : p2Images
      drawPlayer(ctx, player, myChar.color, imagesToUse)
      ctx.restore()

      drawHud(ctx, cssW, cssH, snap, playerKey, stage, me, theme)

      if (counting) {
        const remain = snap.startTime - Date.now()
        const n = Math.ceil(remain / 1000)
        const sub = (remain % 1000) / 1000
        const cscale = 0.7 + sub * 0.6
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = Math.min(1, sub * 1.6)
        ctx.fillStyle = myChar.color
        ctx.shadowColor = myChar.glow || '#fff'
        ctx.shadowBlur = 30
        ctx.font = `900 ${Math.round(120 * cscale)}px sans-serif`
        ctx.fillText(String(n), cssW / 2, cssH / 2)
        ctx.restore()
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = 'bold 16px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('GET READY', cssW / 2, cssH / 2 + 80)
      } else if (goFlashRef.current > 0) {
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = Math.min(1, goFlashRef.current)
        const cscale = 1 + (1 - goFlashRef.current) * 0.6
        ctx.translate(cssW / 2, cssH / 2)
        ctx.scale(cscale, cscale)
        ctx.fillStyle = '#fff'
        ctx.shadowColor = myChar.color
        ctx.shadowBlur = 30
        ctx.font = '900 96px sans-serif'
        ctx.fillText('GO!', 0, 0)
        ctx.restore()
      }
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      useParkourStore.getState().unmount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId])

  if (!panel) {
    return (
      <div className="flex items-center justify-center w-full h-full text-red-500 text-sm font-mono">
        Invalid canvasId: {canvasId}
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} id={canvasId} className="w-full h-full block" />
      {isOver && (
        <ParkourEndCredits
          playerKey={panel.playerKey}
          player1={player1}
          player2={player2}
          onPlayAgain={handlePlayAgain}
          onBackToSelect={handleBackToSelect}
        />
      )}
    </div>
  )
}

// HUD: stage progress, win tally, and the "tops Stage N" banner — drawn in screen
// (CSS-pixel) space on top of the world.
function drawHud(ctx, w, h, snap, playerKey, stage, me, theme) {
  const oppKey = playerKey === 'player1' ? 'player2' : 'player1'
  const dark = theme.skyTop === '#2a2350'

  ctx.save()
  ctx.textAlign = 'left'
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.9)' : 'rgba(20,16,40,0.85)'
  ctx.font = 'bold 13px sans-serif'
  ctx.fillText(`Stage ${snap.stageIndex + 1}/${STAGE_COUNT} · ${stage.name}`, 12, 22)
  ctx.font = '12px sans-serif'
  ctx.fillText(
    `You ${snap.stageWins[playerKey]}   Rival ${snap.stageWins[oppKey]}   (first to ${STAGES_TO_WIN})`,
    12, 40,
  )

  const mm = Math.floor(snap.timeLeft / 60)
  const ss = String(snap.timeLeft % 60).padStart(2, '0')
  const timeStr = `${mm}:${ss}`
  const lowTime = snap.timeLeft <= 10 && !snap.winner

  // Draw pill background for timer
  ctx.fillStyle = dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)'
  ctx.beginPath()
  ctx.roundRect(w / 2 - 45, 10, 90, 50, 12)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.font = '900 26px "Plus Jakarta Sans", sans-serif'
  ctx.fillStyle = lowTime ? '#ff3333' : (dark ? '#ffffff' : '#111111')
  if (lowTime) {
    ctx.shadowColor = '#ff3333'
    ctx.shadowBlur = 10
  }
  ctx.fillText(timeStr, w / 2, 36)
  ctx.shadowBlur = 0
  
  ctx.font = '700 10px "Space Grotesk", sans-serif'
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)'
  ctx.fillText('TIME LEFT', w / 2, 51)

  if (snap.stageWinner && !snap.winner) {
    const youWon = snap.stageWinner === playerKey
    ctx.textAlign = 'center'
    ctx.fillStyle = youWon ? '#2e7d32' : '#b00020'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText(
      youWon ? `You top Stage ${snap.stageIndex + 1}!` : `Rival tops Stage ${snap.stageIndex + 1}`,
      w / 2, h / 2,
    )
    ctx.fillStyle = dark ? 'rgba(255,255,255,0.7)' : 'rgba(20,16,40,0.6)'
    ctx.font = '13px sans-serif'
    ctx.fillText('Next stage…', w / 2, h / 2 + 26)
  }
  ctx.restore()
}

// Shared end-credits overlay. Each player's value is stages won; the winner is
// whoever reached STAGES_TO_WIN first.
function ParkourEndCredits({ playerKey, player1, player2, onPlayAgain, onBackToSelect }) {
  const { winner, stageWins } = useParkourStore.getState()
  const isP1 = playerKey === 'player1'
  const oppKey = isP1 ? 'player2' : 'player1'

  const me = isP1 ? player1 : player2
  const opp = isP1 ? player2 : player1
  const myChar = CHARACTERS.find((c) => c.id === me?.avatarKey) ?? CHARACTERS[0]
  const oppChar = CHARACTERS.find((c) => c.id === opp?.avatarKey) ?? CHARACTERS[1]

  return (
    <EndCredits
      title="Parkour"
      outcome={winner === 'tie' ? 'tie' : winner === playerKey ? 'win' : 'lose'}
      isPlayer1={isP1}
      valueLabel="Stages Won"
      subtitle={winner === 'nobody' ? "Time's up! Both players failed to finish." : `First to win ${STAGES_TO_WIN} of ${STAGE_COUNT} stages`}
      myChar={myChar}
      myName={me?.name || (isP1 ? 'Player 1' : 'Player 2')}
      myValue={stageWins[playerKey]}
      oppChar={oppChar}
      oppName={opp?.name || (isP1 ? 'Player 2' : 'Player 1')}
      oppValue={stageWins[oppKey]}
      playAgainKey={null}
      onPlayAgain={onPlayAgain}
      onBackToSelect={onBackToSelect}
    />
  )
}
