import { describe, expect, it, vi } from 'vitest'
import { createLoopControls } from './GameLoop'

describe('fixed-step game loop', () => {
  it('large frame delta runs at most 5 simulation steps', () => {
    const simulate = vi.fn()
    const renderRenderer = vi.fn()
    let stepFn = null
    const raf = vi.fn((cb) => {
      stepFn = cb
      return 1
    })
    const caf = vi.fn()

    const controls = createLoopControls()
    controls.start({
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
      simulate,
      getRenderers: () => [{}],
      renderRenderer,
    })

    // First frame: initializes lastTime (skips simulation)
    stepFn(100)

    // Second frame: large delta → capped at 5 simulation steps
    stepFn(300)

    expect(simulate.mock.calls.length).toBeLessThanOrEqual(5)
  })

  it('render is called once per renderer after simulation catch-up', () => {
    const simulate = vi.fn()
    const renderRenderer = vi.fn()
    let stepFn = null
    const raf = vi.fn((cb) => {
      stepFn = cb
      return 1
    })
    const caf = vi.fn()

    const renderers = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]

    const controls = createLoopControls()
    controls.start({
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
      simulate,
      getRenderers: () => renderers,
      renderRenderer,
    })

    // First frame: initializes lastTime
    stepFn(0)

    // Second frame: runs simulation then renders all renderers
    stepFn(100)

    expect(renderRenderer).toHaveBeenCalledTimes(3)
    expect(renderRenderer).toHaveBeenNthCalledWith(1, renderers[0])
    expect(renderRenderer).toHaveBeenNthCalledWith(2, renderers[1])
    expect(renderRenderer).toHaveBeenNthCalledWith(3, renderers[2])
  })

  it('loop start is idempotent', () => {
    const raf = vi.fn(() => 1)
    const caf = vi.fn()

    const controls = createLoopControls()
    controls.start({
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
      getRenderers: () => [{}],
    })

    controls.start({
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
      getRenderers: () => [{}],
    })

    expect(raf).toHaveBeenCalledTimes(1)
  })

  it('loop stops when renderer count reaches zero', () => {
    let rendererCount = 1
    const simulate = vi.fn()
    const renderRenderer = vi.fn()
    let stepFn = null
    const raf = vi.fn((cb) => {
      stepFn = cb
      return 1
    })
    const caf = vi.fn()

    const controls = createLoopControls()
    controls.start({
      requestAnimationFrame: raf,
      cancelAnimationFrame: caf,
      simulate,
      getRenderers: () => (rendererCount > 0 ? [{}] : []),
      renderRenderer,
    })

    // First frame: initializes lastTime
    stepFn(0)

    // Remove all renderers
    rendererCount = 0

    // Second frame: should detect 0 renderers and stop
    stepFn(100)

    expect(controls.running).toBe(false)
  })
})
