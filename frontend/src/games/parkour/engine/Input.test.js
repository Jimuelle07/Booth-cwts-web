import { describe, expect, it } from 'vitest'
import { createInputReader } from './Input'

describe('Parkour input reader', () => {
  it('maps P1 keys and P2 keyboard, arrow, and numpad aliases', () => {
    const reader = createInputReader()
    const snapshot = reader.read(
      new Set(['w', 'a', 's', 'd', 'i', 'j', 'k', 'l', 'ArrowUp', 'ArrowLeft', 'Numpad5', 'Numpad6']),
    )

    expect(snapshot.p1).toMatchObject({
      left: true,
      right: true,
      down: true,
      jumpHeld: true,
      jumpPressed: true,
    })
    expect(snapshot.p2).toMatchObject({
      left: true,
      right: true,
      down: true,
      jumpHeld: true,
      jumpPressed: true,
    })
  })

  it('reports jumpPressed only on the rising edge', () => {
    const reader = createInputReader()

    const r1 = reader.read(new Set(['w', 'Numpad8']))
    expect(r1).toMatchObject({
      p1: { jumpHeld: true, jumpPressed: true },
      p2: { jumpHeld: true, jumpPressed: true },
    })

    const r2 = reader.read(new Set(['w', 'Numpad8']))
    expect(r2).toMatchObject({
      p1: { jumpHeld: true, jumpPressed: false },
      p2: { jumpHeld: true, jumpPressed: false },
    })

    const r3 = reader.read(new Set())
    expect(r3).toMatchObject({
      p1: { jumpHeld: false, jumpPressed: false },
      p2: { jumpHeld: false, jumpPressed: false },
    })

    const r4 = reader.read(new Set(['w', 'Numpad8']))
    expect(r4).toMatchObject({
      p1: { jumpHeld: true, jumpPressed: true },
      p2: { jumpHeld: true, jumpPressed: true },
    })
  })
})
