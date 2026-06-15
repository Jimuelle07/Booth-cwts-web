import { describe, expect, it } from 'vitest'
import { assetManifest, getRuntimeImageAssets } from './manifest'

describe('Parkour asset manifest', () => {
  it('preserves the four-slot runtime image budget', () => {
    expect(Object.keys(assetManifest)).toEqual(['platforms', 'players', 'objects', 'background'])
    expect(getRuntimeImageAssets()).toHaveLength(4)
  })
})
