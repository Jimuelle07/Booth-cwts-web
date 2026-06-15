import { describe, expect, it } from 'vitest'
import registry from './registry'

describe('game registry', () => {
  it('registers Parkour as a selectable game component', () => {
    const parkour = registry.find((game) => game.id === 'parkour')

    expect(parkour).toMatchObject({ id: 'parkour', name: 'Parkour' })
    expect(typeof parkour.component).toBe('function')
  })
})
