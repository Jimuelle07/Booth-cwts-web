/**
 * Runtime image asset manifest for Parkour.
 * Capped at 4 slots. Each slot tolerates missing paths and draws
 * Canvas primitive fallbacks.
 */
export const assetManifest = {
  platforms: { path: null, loaded: false, image: null },
  players: { path: null, loaded: false, image: null },
  objects: { path: null, loaded: false, image: null },
  background: { path: null, loaded: false, image: null },
}

export function getRuntimeImageAssets() {
  return Object.values(assetManifest)
}
