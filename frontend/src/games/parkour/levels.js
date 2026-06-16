// Three race-to-the-top stages, harder each round.
//
// World coordinates use the canvas convention: +y points DOWN. Players spawn near
// the BOTTOM (large y) and race UP to the finish line near the TOP (small y).
// Every stage shares one fixed world WIDTH so the whole level is always visible
// horizontally — the camera only ever scrolls vertically.
//
// Platform `type` drives both look and behaviour (handled in ParkourGame):
//   platform → solid, stable ground
//   cloud    → fades out shortly after you land, then puffs back; keep moving
//   tree     → springy branch that launches you higher than a normal jump

export const WORLD_WIDTH = 420
const PLAT_H = 18 // default surface thickness
const GROUND_H = 80 // chunky base platform

const mk = (x, y, w, type, h = PLAT_H, moving = false) => ({ x, y, w, h, type, moving })

// Build a stage from a flat list of [x, y, w, type] tuples plus a full-width
// ground slab at the bottom. `finishY` is the world-y a player's top edge must
// rise above to crest the stage.
function makeStage({ id, name, theme, worldHeight, rows, spawnXs }) {
  const groundY = worldHeight - GROUND_H
  const platforms = [
    mk(0, groundY, WORLD_WIDTH, 'ground', GROUND_H),
    ...rows.map(([x, y, w, type, moving]) => mk(x, y, w, type, PLAT_H, moving)),
  ]
  return {
    id,
    name,
    theme,
    worldWidth: WORLD_WIDTH,
    worldHeight,
    finishY: 170,
    spawn: {
      // top-left y a touch above the ground so players settle onto it at start
      p1: { x: spawnXs[0], y: groundY - 90 },
      p2: { x: spawnXs[1], y: groundY - 90 },
    },
    platforms,
  }
}

// ── Stage 1 · Headquarters Climb ─────────────────────────────────────────────
// Wide, dense, overlapping ledges. Mostly solid with a gentle taste of clouds
// and one springy branch so players learn each surface.
const STAGE_1 = makeStage({
  id: 'stage-1',
  name: 'Headquarters',
  theme: 'joy',
  worldHeight: 1700,
  spawnXs: [120, 240],
  rows: [
    [50, 1560, 120, 'platform', true],
    [200, 1460, 140, 'platform'],
    [40, 1360, 100, 'platform', true],
    [210, 1260, 110, 'cloud'],
    [50, 1160, 150, 'platform', true],
    [210, 1060, 120, 'platform'],
    [50, 960, 90, 'tree'],
    [220, 860, 130, 'platform', true],
    [50, 760, 110, 'cloud'],
    [210, 660, 140, 'platform'],
    [50, 560, 100, 'platform', true],
    [210, 460, 130, 'cloud'],
    [60, 360, 120, 'platform'],
    [200, 260, 110, 'platform', true],
  ],
})

// ── Stage 2 · Cloud Town ─────────────────────────────────────────────────────
// Taller, narrower ledges with real gaps. Clouds dominate, so standing still
// drops you — momentum matters. A couple of trees offer shortcuts.
const STAGE_2 = makeStage({
  id: 'stage-2',
  name: 'Cloud Town',
  theme: 'sad',
  worldHeight: 2300,
  spawnXs: [120, 240],
  rows: [
    [60, 2160, 100, 'platform', true],
    [230, 2060, 90, 'cloud'],
    [40, 1960, 110, 'platform', true],
    [220, 1860, 80, 'cloud'],
    [70, 1760, 90, 'tree'],
    [240, 1660, 100, 'cloud', true],
    [50, 1560, 90, 'platform'],
    [230, 1460, 80, 'cloud', true],
    [60, 1360, 90, 'cloud'],
    [220, 1260, 110, 'platform', true],
    [40, 1160, 80, 'cloud'],
    [230, 1060, 90, 'tree'],
    [70, 960, 80, 'cloud', true],
    [230, 860, 100, 'platform'],
    [50, 760, 90, 'cloud'],
    [220, 660, 80, 'cloud', true],
    [60, 560, 110, 'platform'],
    [220, 460, 90, 'cloud', true],
    [60, 360, 100, 'cloud'],
    [200, 260, 110, 'platform'],
  ],
})

// ── Stage 3 · Imagination Peak ───────────────────────────────────────────────
// Tallest and sparsest. Tight, far-apart cloud and tree hops with little solid
// footing — every jump counts.
const STAGE_3 = makeStage({
  id: 'stage-3',
  name: 'Imagination Peak',
  theme: 'fear',
  worldHeight: 2900,
  spawnXs: [130, 250],
  rows: [
    [70, 2760, 90, 'platform', true],
    [250, 2650, 80, 'cloud'],
    [60, 2540, 70, 'tree'],
    [250, 2430, 80, 'cloud', true],
    [70, 2320, 90, 'cloud'],
    [260, 2210, 70, 'tree'],
    [60, 2100, 80, 'cloud', true],
    [250, 1990, 80, 'cloud'],
    [80, 1880, 70, 'tree'],
    [260, 1770, 80, 'cloud', true],
    [60, 1660, 90, 'cloud'],
    [240, 1550, 80, 'platform', true],
    [70, 1440, 70, 'cloud'],
    [260, 1330, 80, 'tree'],
    [70, 1220, 90, 'cloud', true],
    [250, 1110, 80, 'cloud'],
    [60, 1000, 70, 'tree'],
    [250, 890, 80, 'cloud', true],
    [80, 780, 90, 'cloud'],
    [250, 670, 70, 'tree'],
    [60, 560, 80, 'cloud', true],
    [240, 450, 90, 'cloud'],
    [80, 340, 70, 'tree'],
    [220, 250, 80, 'cloud', true],
  ],
})

export const STAGES = [STAGE_1, STAGE_2, STAGE_3]

// Per-theme palette for the sky gradient and platform tints.
export const THEMES = {
  joy: { skyTop: '#fff4c2', skyBottom: '#ffd65c', cloud: '#fffdf5', tree: '#5bbd54' },
  sad: { skyTop: '#cfe6ff', skyBottom: '#7fb2e8', cloud: '#ffffff', tree: '#4f9c6b' },
  fear: { skyTop: '#2a2350', skyBottom: '#5a4a9c', cloud: '#e8e3ff', tree: '#6b8f5a' },
}
