/**
 * P1: w=jump, a=left, s=down, d=right
 * P2: i/ArrowUp/Numpad8=jump, j/ArrowLeft=left, k/ArrowDown/Numpad5=down, l/ArrowRight/Numpad6=right
 */
const P1_JUMP_KEYS = new Set(['w'])
const P1_LEFT_KEYS = new Set(['a'])
const P1_RIGHT_KEYS = new Set(['d'])
const P1_DOWN_KEYS = new Set(['s'])

const P2_JUMP_KEYS = new Set(['i', 'ArrowUp', 'Numpad8'])
const P2_LEFT_KEYS = new Set(['j', 'ArrowLeft', 'Numpad4'])
const P2_RIGHT_KEYS = new Set(['l', 'ArrowRight', 'Numpad6'])
const P2_DOWN_KEYS = new Set(['k', 'ArrowDown', 'Numpad5'])

function anyKeyInSet(keys, pressedKeys) {
  for (const key of keys) {
    if (pressedKeys.has(key)) return true
  }
  return false
}

export function createInputReader() {
  let prevP1JumpHeld = false
  let prevP2JumpHeld = false

  function read(pressedKeys) {
    const p1JumpHeld = anyKeyInSet(P1_JUMP_KEYS, pressedKeys)
    const p2JumpHeld = anyKeyInSet(P2_JUMP_KEYS, pressedKeys)

    const p1JumpPressed = p1JumpHeld && !prevP1JumpHeld
    const p2JumpPressed = p2JumpHeld && !prevP2JumpHeld

    prevP1JumpHeld = p1JumpHeld
    prevP2JumpHeld = p2JumpHeld

    return {
      p1: {
        left: anyKeyInSet(P1_LEFT_KEYS, pressedKeys),
        right: anyKeyInSet(P1_RIGHT_KEYS, pressedKeys),
        down: anyKeyInSet(P1_DOWN_KEYS, pressedKeys),
        jumpHeld: p1JumpHeld,
        jumpPressed: p1JumpPressed,
      },
      p2: {
        left: anyKeyInSet(P2_LEFT_KEYS, pressedKeys),
        right: anyKeyInSet(P2_RIGHT_KEYS, pressedKeys),
        down: anyKeyInSet(P2_DOWN_KEYS, pressedKeys),
        jumpHeld: p2JumpHeld,
        jumpPressed: p2JumpPressed,
      },
    }
  }

  return { read }
}
