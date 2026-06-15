/**
 * Fixed-timestep game loop.
 *
 * - 60 Hz simulation steps (dt ≈ 16.667 ms)
 * - Delta accumulator catches up real elapsed time
 * - Max 5 simulation steps per RAF to prevent spiral of death
 * - One render pass per attached renderer per RAF
 * - Only starts when at least one renderer is attached
 * - Automatically stops when renderer count reaches zero
 */
const FIXED_DT = 1000 / 60 // ~16.667 ms
const MAX_STEPS = 5

export function createLoopControls() {
  let running = false
  let rafId = null
  let lastTime = null
  let accumulator = 0

  // Callbacks set on start()
  let simulateFn = null
  let getRenderersFn = null
  let renderRendererFn = null
  // Real RAF wrapper (may be mocked in tests)
  let raf = null

  function step(timestamp) {
    if (!running) return

    // Auto-stop if no renderers attached
    if (getRenderersFn) {
      const renderers = getRenderersFn()
      if (renderers.length === 0) {
        running = false
        rafId = null
        return
      }
    }

    // Initialize lastTime on first frame
    if (lastTime === null) {
      lastTime = timestamp
      rafId = raf(step)
      return
    }

    // Accumulate real elapsed time
    const elapsed = timestamp - lastTime
    lastTime = timestamp
    accumulator += elapsed

    // Fixed-step simulation (max MAX_STEPS catches)
    let steps = 0
    while (accumulator >= FIXED_DT && steps < MAX_STEPS) {
      if (simulateFn) simulateFn(FIXED_DT)
      accumulator -= FIXED_DT
      steps++
    }

    // Cap remaining accumulator to prevent spiral of death
    if (accumulator > FIXED_DT) {
      accumulator = 0
    }

    // Render all attached renderers
    if (renderRendererFn && getRenderersFn) {
      const renderers = getRenderersFn()
      for (const renderer of renderers) {
        renderRendererFn(renderer)
      }
    }

    rafId = raf(step)
  }

  return {
    start({ requestAnimationFrame, simulate, getRenderers, renderRenderer }) {
      if (running) return false

      // Don't start without renderers
      if (getRenderers && getRenderers().length === 0) return false

      running = true
      raf = requestAnimationFrame
      simulateFn = simulate || null
      getRenderersFn = getRenderers || null
      renderRendererFn = renderRenderer || null
      lastTime = null
      accumulator = 0
      rafId = raf(step)
      return true
    },

    stop({ cancelAnimationFrame }) {
      if (!running) return
      running = false
      simulateFn = null
      getRenderersFn = null
      renderRendererFn = null
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    },

    get running() {
      return running
    },
  }
}
