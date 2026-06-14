import { useEffect, useRef, useCallback, useState } from 'react'
import {
  attachRenderer,
  detachRenderer,
  resetRun,
  restartRun,
  getSnapshot,
  dispose,
  tick,
  calculateFinalResult,
} from './State.js'
import { createInputReader } from './engine/Input.js'
import {
  updatePlayer,
  touchCheckpoint,
  filterActivePlatforms,
  createCrumblingState,
  updateCrumblingTimers,
  getMovingPlatformState,
  isPlatformActive,
} from './engine/Physics.js'
import { stages } from './levels/index.js'
import { createRenderer, renderFrame } from './rendering/Renderer.js'
import { createCamera, followCamera } from './engine/Camera.js'
import { drawOverlay, setCalculateFinalResult } from './rendering/Overlay.js'
import {
  createParticleSystem,
  updateParticles,
  spawnDeathParticles,
  emitGrabContactParticles,
} from './rendering/Particles.js'
import useGameStore from '../../store/useGameStore.js'

setCalculateFinalResult(calculateFinalResult)

const PANEL_MAP = {
  'canvas-left': { panelSlot: 'left', playerId: 'p1' },
  'canvas-right': { panelSlot: 'right', playerId: 'p2' },
}

const rendererRegistry = {}
let particleSystem = createParticleSystem()
let crumblingState = createCrumblingState()

function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const w = Math.round(rect.width * dpr)
  const h = Math.round(rect.height * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

export default function ParkourGame({
  canvasId,
  player1,
  player2,
  pressedKeys,
}) {
  const canvasRef = useRef(null)
  const hasInitRef = useRef(false)
  const inputReaderRef = useRef(null)
  const rendererRef = useRef(null)
  const cameraRef = useRef(null)
  const [isGameOver, setIsGameOver] = useState(false)
  const setPhase = useGameStore((s) => s.setPhase)

  // Refs to access latest values inside the effect without re-triggering it.
  const isGameOverRef = useRef(isGameOver)
  const pressedKeysRef = useRef(pressedKeys)
  useEffect(() => {
    isGameOverRef.current = isGameOver
    pressedKeysRef.current = pressedKeys
  })

  const panel = PANEL_MAP[canvasId]

  const handleRestart = useCallback(() => {
    restartRun()
    setIsGameOver(false)
  }, [])

  const handleBackToSelect = useCallback(() => {
    dispose()
    hasInitRef.current = false
    setPhase('GAME_SELECT')
  }, [setPhase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !panel) return

    const { panelSlot, playerId } = panel

    if (!hasInitRef.current) {
      hasInitRef.current = true
      inputReaderRef.current = createInputReader()
      particleSystem = createParticleSystem()
      crumblingState = createCrumblingState()

      const snap = getSnapshot()
      if (!snap.runId) {
        resetRun({
          player1: player1 || { name: 'Player 1', avatarKey: 'joy' },
          player2: player2 || { name: 'Player 2', avatarKey: 'anger' },
          stage: stages[0],
        })
      }
    }

    resizeCanvas(canvas)
    const resizeObserver = new ResizeObserver(() => resizeCanvas(canvas))
    resizeObserver.observe(canvas)

    const currentStage = stages[getSnapshot().currentStageIndex] || stages[0]
    const camera = createCamera(currentStage.width, currentStage.height)
    cameraRef.current = camera

    const renderer = createRenderer(canvas, camera, playerId, currentStage)
    rendererRef.current = renderer

    rendererRegistry[panelSlot] = {
      playerId,
      render: () => {
        const r = rendererRef.current
        const c = cameraRef.current
        if (!r || !c) return
        const snap = getSnapshot()
        const stage = stages[snap.currentStageIndex] || stages[0]
        r.stage = stage
        r.camera = c

        const targetPlayer = playerId === 'p1' ? snap.player1 : snap.player2
        if (targetPlayer) {
          const dpr = window.devicePixelRatio || 1
          followCamera(
            c,
            targetPlayer.x + targetPlayer.width / 2,
            targetPlayer.y + targetPlayer.height / 2,
            canvas.width / dpr,
            canvas.height / dpr
          )
        }

        const players = [snap.player1, snap.player2].filter(Boolean)
        const visiblePlatforms = stage.platforms.filter((p) =>
          isPlatformActive(p, crumblingState)
        )
        const visibleStage = { ...stage, platforms: visiblePlatforms }
        renderFrame(r, players, visibleStage, particleSystem)
        const ctx = canvas.getContext('2d')
        drawOverlay(ctx, canvas, snap, playerId, snap.currentStageIndex)

        if (snap.phase === 'gameOver' && !isGameOverRef.current) {
          setIsGameOver(true)
        } else if (snap.phase !== 'gameOver' && isGameOverRef.current) {
          setIsGameOver(false)
        }
      },
      camera,
    }

    attachRenderer({ panelSlot, playerId, canvas })

    const snapshot = getSnapshot()
    snapshot.loopControls.start({
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
      cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
      simulate: (dt) => {
        const snap = getSnapshot()
        const stage = stages[snap.currentStageIndex] || stages[0]

        if (snap.phase === 'racing') {
          const input = inputReaderRef.current.read(pressedKeysRef.current)

          const crumblingPlatforms = stage.platforms.filter(
            (p) => p.type === 'crumbling'
          )
          updateCrumblingTimers(
            crumblingState,
            crumblingPlatforms,
            [snap.player1, snap.player2].filter(Boolean),
            dt
          )

          const stateKeyToPhysicsKey = { player1: 'p1', player2: 'p2' }
          for (const [stateKey, physicsKey] of Object.entries(
            stateKeyToPhysicsKey
          )) {
            const playerData = snap[stateKey]
            if (!playerData) continue

            const movingPlatforms = stage.movingPlatforms.map((mp) =>
              getMovingPlatformState(mp, snap.raceTimeMs, dt)
            )
            const activePlatforms = filterActivePlatforms(
              [...stage.platforms, ...movingPlatforms],
              crumblingState
            )

            const events = updatePlayer(
              playerData,
              input[physicsKey],
              dt,
              stage,
              activePlatforms,
              stage.hazards,
              snap.phase,
              [snap.player1, snap.player2].filter(Boolean)
            )
            for (const ev of events) {
              if (ev.type === 'death') {
                spawnDeathParticles(particleSystem, playerData.x, playerData.y)
              }
              if (ev.type === 'grab') {
                emitGrabContactParticles(particleSystem, ev.x, ev.y)
              }
            }
            touchCheckpoint(playerData, stage.checkpoints)
          }

          const finishMap = {}
          if (
            snap.player1 &&
            snap.player1.y <= stage.finishZone.y + stage.finishZone.height
          )
            finishMap.p1 = true
          if (
            snap.player2 &&
            snap.player2.y <= stage.finishZone.y + stage.finishZone.height
          )
            finishMap.p2 = true

          tick(dt, finishMap)
        } else {
          tick(dt)
        }

        updateParticles(particleSystem, dt / 1000)
      },
      getRenderers: () => {
        const snap = getSnapshot()
        return Object.entries(snap.renderers || {}).map(([slot, data]) => ({
          panelSlot: slot,
          ...data,
        }))
      },
      renderRenderer: (rendererData) => {
        const entry = rendererRegistry[rendererData.panelSlot]
        if (entry) entry.render()
      },
    })

    return () => {
      resizeObserver.disconnect()
      delete rendererRegistry[panelSlot]
      detachRenderer(panelSlot)
      rendererRef.current = null
      cameraRef.current = null

      const snap = getSnapshot()
      if (snap.rendererCount === 0) {
        dispose()
        hasInitRef.current = false
      }
    }
  }, [canvasId, panel, player1, player2])

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
      {isGameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 gap-3 pointer-events-auto z-10">
          <button
            onClick={handleRestart}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-lg shadow-lg transition-colors"
          >
            Restart Parkour
          </button>
          <button
            onClick={handleBackToSelect}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold text-sm rounded-lg shadow-lg transition-colors"
          >
            Back to Game Select
          </button>
        </div>
      )}
    </div>
  )
}
