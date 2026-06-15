# Grab & Climb Feature Spec

## Overview

Add a platform-grabbing system to the parkour game that allows players to grab onto edges of platforms (edge hang) and cling to walls (wall cling), then climb over them by pressing jump. This coexists alongside the existing wall-slide/wall-jump mechanics and the existing ledge-grab (auto-snap-on-top).

---

## Core Mechanics

### 1. Wall Cling

- When a player is airborne and makes contact with a grabbable wall/platform side during X collision resolution, they automatically enter the **wall-cling** state.
- **Override**: Holding **down** while airborne suppresses all auto-grab. The player bounces off the wall normally instead of clinging.
- The player sticks to the surface at the exact contact point; gravity is paused.
- Distinct from the existing wall-slide: wall-slide requires pressing *into* the wall and the player slowly descends; wall-cling is an automatic grab on contact with a grabbable surface (unless down is held).

### 2. Edge Hang

- When a player is airborne and contacts the top-edge area of a platform, they enter the **edge-hang** state IF pressing **toward the platform center**.
- **"Toward" definition**: Right if player center X < platform center X, left if player center X > platform center X.
- **Coexistence with ledge-grab**: If the player is near an edge but NOT pressing toward the platform center, the existing ledge-grab (auto-snap-on-top) triggers instead. Both mechanics coexist — toward input = hang, no input = snap.
- **Override**: Holding **down** while airborne suppresses all grab (neither edge-hang nor ledge-grab triggers).
- **Downward catch**: Edge-hang also triggers during downward movement (vy > 0, falling) if the player passes near a platform edge while pressing toward it. This allows skill-based edge catching while falling.
- The player hangs from the edge of the platform, suspended below the top surface at `platform.y + 2`.

### 3. Climb-Up

- From either **wall-cling** or **edge-hang**, pressing jump triggers a smooth climb-up animation (reuses the existing `climbing` state with ease-out quad lerp).
- **Climb-up speed**: Normally 160ms. When the hang timer is below 1 second (depleted), speed increases to 100ms — an urgency boost for last-second climbs.
- The player pulls themselves onto the platform surface: `climbTargetY = platform.y - player.height`.
- `climbStartY` is the player's current `y` (may vary due to edge-hang offset or slow-slide descent).
- **No separate "up" input exists** in the current input system — `w`/`i`/`ArrowUp` serve as both jump and up, so `jumpPressed` covers both.

### 4. Wall-Jump Off Cling

- From **wall-cling**: pressing *away from the wall* while pressing jump triggers a wall jump (launches the player away from the wall, reusing existing `WALL_JUMP_VELOCITY_X` / `WALL_JUMP_VELOCITY_Y` constants).
- Jump alone (without away-direction) triggers climb-up instead.
- Wall-jump off cling does NOT apply to edge-hang (there's no wall to push off).

### 5. Drop / Release

- From either state, pressing **down** releases the grab and drops the player (with a small downward velocity `vy = 10` to prevent re-grab on the same frame).
- From either state, pressing **away** from the platform also releases the grab (with a small horizontal push away).
- No re-grab cooldown — player can re-grab immediately after releasing. Skill-based chain grabs are possible.
- After the **timed hang duration** expires, the player is automatically released (falls).

### 6. Shimmy (Edge Hang Only)

- While in the **edge-hang** state, pressing left/right moves the player horizontally along the platform edge at `GRAB_SHIMMY_SPEED` (150 px/s).
- Shimmy is infinite — no movement limit per grab.
- The player is clamped to the platform's horizontal bounds so they can't shimmy past the edges.
- Not available during wall-cling (player is locked to the contact point).

### 7. Player-Player Shimmy Collision (NEW)

- If two players are grabbing the **same platform edge** and one shimmies into the other, the player being pushed into is **thrown off** the edge (released into airborne state with `vy = 10`).
- Detection: when a shimmying player's AABB overlaps the other grabbing player's AABB on the same platform, the stationary player is released.
- The pushing player remains grabbing. If both shimmy toward each other, both are released.
- This adds competitive interaction: players can fight over limited edge space.

### 8. Chain-Grabbing

- Player can drop from one grab and re-grab a platform below by: (1) pressing down to release, (2) releasing down, (3) pressing toward the next platform center before passing it.
- Requires timing skill — no automatic chain. The player must release down before the next edge to allow re-grab.

---

## Physics Integration

### Pipeline Placement

The grab system inserts into the `updatePlayer` pipeline:

```
updatePlayer():
  1. Clear visual indicators
  2. If player.climbing → handle climb lerp, return    ← EXISTING
  3. If player.grabbing → handle grab physics, return  ← NEW
  4. Normal physics (timers, input, gravity, collision, wall-slide, jump, death)
```

### Input Priority for Grab Detection

During collision resolution, input determines the grab outcome:

| Input while airborne | Wall contact | Near edge (upward) | Near edge (downward) |
|---|---|---|---|
| Holding **down** | No grab (bounce off) | No grab (pass through) | No grab (fall through) |
| Pressing **toward** platform center | Wall-cling (if grabbable side) | Edge-hang | Edge-hang (catch) |
| No direction input | Wall-cling (if grabbable side) | Ledge-grab (snap on top) | Nothing (fall past) |

**"Toward platform center"**: Right if player center X < platform center X, left if >. If player center X is within 10px of platform center X, either direction counts as "toward."

### Grab Detection (in collision resolution)

**X collision** (`resolveCollisionAxis`): When a wall/platform side is hit:
- If `input.down` → normal push-out (no grab). Wall-slide can still activate if pressing into the wall.
- If grabbable → snap player flush against wall surface, zero all velocity, set `player.grabbing = true` with `grabType = 'wall-cling'`.
- If not grabbable → normal push-out. Wall-slide can activate.

**Y collision** (`resolveCollisionAxisY`), upward (`vy < 0`):
- If `input.down` → skip grab entirely. Normal pass-through or head-bump.
- If near edge AND pressing toward platform center → edge-hang (snap to `platform.y + 2`).
- If near edge AND NOT pressing toward → ledge-grab (snap on top, `grounded = true`). Existing behavior preserved.
- If not near edge → normal head-bump or pass-through.

**Y collision** (`resolveCollisionAxisY`), downward (`vy > 0`):
- If `input.down` → skip grab (normal landing or pass-through).
- If near edge AND pressing toward platform center AND `prevFeetY < platform.y` (was above, now passing through) → edge-hang catch.
- Otherwise → normal landing.

### Pass-Through Platform Edge-Hang

Pass-through platforms (`passThrough: true`) skip X-axis collision entirely and skip most Y collision. Edge-hang detection intercepts BEFORE the `passThrough` skip:

```
vy < 0 or vy > 0:
  1. Check for edge-hang conditions (near edge + toward input + not holding down)
     → If met: set grabbing state, return
  2. If platform.passThrough → continue (pass through)
  3. Normal collision resolution
```

- **Wall-cling on pass-through: impossible** — no side contact ever occurs.
- **Edge-hang on pass-through: works** from both above and below, same as solid platforms.

### Grab vs Wall-Slide Priority

Grab takes priority over wall-slide. If not holding down and contacting a grabbable wall → cling. Wall-slide still functions for:
- Holding down while airborne (suppresses grab, wall-slide still works)
- Non-grabbable surfaces (`grabbable: false`)
- Pass-through platforms (no side collision, so wall-slide on pass-through is moot)

### Phase Restriction

Grab mechanics are only active during the **`racing`** phase. During `countdown` and `stageComplete`, grab is disabled — wall contact uses normal push-out, near-edge uses normal ledge-grab.

---

## Grabbable Surfaces

| Platform Type | Edge Hang | Wall Cling | Notes |
|---|---|---|---|
| Walls (left/right boundary) | ✅ | ✅ | Edge-hang only reachable at wall tops (above finish zone in practice) |
| Solid ledges | ✅ | ✅ | Both edge-hang and wall-cling work |
| Pass-through ledges | ✅ (from below/above) | ❌ | No side collision; edge-hang intercepts before pass-through skip |
| Moving platforms | ✅ | ✅ | Player carried with platform delta while hanging/clinging |
| Crumbling platforms | ✅ | ✅ | Hanging/clinging triggers the crumble timer, just like standing |

---

## Per-Platform Configuration

Each platform in level data can optionally specify grab properties:

```js
{
  id: 'ledge-5',
  type: 'solid',
  x: 650, y: 3860, width: 240, height: 24,
  // Grab properties (all optional, defaults applied):
  grabbable: true,           // default: true — set false to disable all grab on this platform
  hangPhysics: 'motionless', // 'motionless' | 'slow-slide' (default: 'motionless')
  hangTimeMs: 5000,          // default: 5000ms (5s); 3000ms for crumbling; 0 = unlimited
}
```

### Defaults

- `grabbable`: `true` — all platforms (including pass-through, moving, crumbling) are grabbable by default. Set to `false` to make a platform function only as a standard collision surface (wall-slide still works).
- `hangPhysics`: `'motionless'` — player hangs motionless by default. Gravity is fully paused.
- `hangTimeMs`: `5000` — 5 seconds default hang before auto-release. Crumbling platforms default to `3000` (3 seconds). Set to `0` for unlimited hang.

### Slow-Slide Mode

When `hangPhysics: 'slow-slide'`, the player slowly descends while clinging/hanging at `GRAB_SLOW_SLIDE_SPEED` (120 px/s). This creates urgency to climb quickly. The descent is applied as `player.y += GRAB_SLOW_SLIDE_SPEED * dtSec` each tick. If the player slides below the platform's bottom edge, they auto-release.

---

## Input Mapping

No new keys are required. Existing inputs are reused:

| Action | P1 | P2 | Trigger |
|---|---|---|---|
| Suppress grab (airborne) | Hold `S` | Hold `K`/`ArrowDown` | `input.down` held while airborne |
| Trigger edge-hang | Toward platform center | Toward platform center | Held toward + near edge |
| Ledge-grab (snap-on-top) | No input | No input | Near edge + no direction input |
| Wall-cling | Auto on contact | Auto on contact | Contact grabbable wall while airborne (unless down held) |
| Climb up | `W` | `I` / `ArrowUp` | `jumpPressed && !awayFromWall` while grabbing |
| Wall jump off cling | `A`+`W` or `D`+`W` | Away + `I`/`ArrowUp` | `jumpPressed && awayFromWall` while wall-clinging |
| Drop/release | `S` or press away | `K`/`ArrowDown` or press away | `input.down` or `awayFromWall` (held) while grabbing |
| Shimmy left | `A` | `J` / `ArrowLeft` | `input.left` (held, edge-hang only) |
| Shimmy right | `D` | `L` / `ArrowRight` | `input.right` (held, edge-hang only) |

---

## State Machine Changes

### New Player State Fields

Add to `createPlayer()` in `Player.js`:

```js
{
  // Grab/climb state
  grabbing: false,           // true when in edge-hang or wall-cling
  grabType: null,            // 'edge-hang' | 'wall-cling' | null
  grabPlatformId: null,      // id of the platform being grabbed
  grabHangTimer: 0,          // ms elapsed in current grab
  grabHangDuration: 5000,    // ms until auto-release (from platform config; 5000 default, 3000 for crumbling)
  grabHangPhysics: 'motionless', // 'motionless' | 'slow-slide'
  grabSide: null,            // 'left' | 'right' — which side of the player contacts the platform
}
```

### State Transitions

```
Airborne + contact with grabbable surface:
  ├─ input.down held → NO GRAB (bounce off / pass through / normal ledge-grab)
  ├─ Near top edge + pressing toward platform center → edge-hang
  ├─ Near top edge + no direction input → ledge-grab (snap on top)  ← EXISTING, PRESERVED
  ├─ Side contact + grabbable → wall-cling
  └─ Downward + near edge + pressing toward → edge-hang (catch)

edge-hang / wall-cling:
  ├─ jumpPressed && !awayFromWall → climb-up animation
  ├─ jumpPressed && awayFromWall (wall-cling only) → wall jump
  ├─ input.down || awayFromWall → release → airborne (vy=10)
  ├─ grabHangTimer >= grabHangDuration → auto-release → airborne (vy=10)
  └─ Shimmy collision (edge-hang only) → other player pushed off

Phase restriction:
  ├─ phase !== 'racing' → grab disabled (normal physics only)
```

### Grab Block Pseudocode

```
if (player.grabbing && phase === 'racing'):
  // 1. Update hang timer
  player.grabHangTimer += dt
  if (grabHangDuration > 0 && grabHangTimer >= grabHangDuration):
    release player → airborne (vy = 10), return events

  // 2. Update jump buffer
  player.jumpBufferTimer = max(0, jumpBufferTimer - dt)
  if (input.jumpPressed): jumpBufferTimer = JUMP_BUFFER_MS

  // 3. Determine away direction
  awayFromWall = (grabSide === 'left' && input.right) || (grabSide === 'right' && input.left)

  // 4. Release (down or away)
  if (input.down || awayFromWall):
    release player → airborne, horizontal push if away, return events

  // 5. Climb-up or Wall-jump (if jump buffer available)
  if (jumpBufferTimer > 0):
    jumpBufferTimer = 0
    if (grabType === 'wall-cling' && awayFromWall):
      wall-jump (WALL_JUMP_VELOCITY_X away, WALL_JUMP_VELOCITY_Y up), return events
    else:
      climbDuration = (grabHangDuration > 0 && grabHangTimer > grabHangDuration - 1000) ? 100 : 160
      start climb animation (climbing=true, climbDuration, climbStartY=player.y, climbTargetY=platform.y-height)
      clear grab state, return events

  // 6. Shimmy (edge-hang only)
  if (grabType === 'edge-hang'):
    vx = input.left ? -SHIMMY_SPEED : input.right ? SHIMMY_SPEED : 0
    player.x += vx * dtSec
    clamp player.x to platform horizontal bounds
    // Check player-player shimmy collision
    for other player grabbing same platform:
      if AABB overlap → push other player off (grabbing=false, vy=10)
  else:
    vx = 0

  // 7. Slow-slide physics
  if (grabHangPhysics === 'slow-slide'):
    player.y += GRAB_SLOW_SLIDE_SPEED * dtSec
    if slid below platform bottom: release → airborne
  else:
    vy = 0

  // 8. Moving platform carry
  if grabPlatform is moving:
    player.x += platformDx
    player.y += platformDy

  // 9. Crumbling check
  if grabPlatform is crumbling && !active:
    release → airborne, return events

  // 10. Timers & death checks
  invulnerabilityTimer = max(0, invulnerabilityTimer - dt)
  check fall death, hazard death (same as climbing block)
  return events
```

---

## Visual Feedback

### Visual Style Philosophy

The game uses a minimalist pixel-art style: colored rectangles for player bodies, white rectangles for eyes, dark rectangles for pupils. All grab-state visuals extend this language using the same primitives (`ctx.fillRect`) rather than introducing sprite sheets or complex shapes.

### Player Rendering During Grab

**Edge-hang:**
- Player body repositioned so feet are at `platform.y + 2` (hanging just below the edge).
- `facingRight` set toward the platform center.
- **Arm rectangles**: Two small body-colored rectangles (6×10 px) extend upward from the player's shoulder positions, gripping the platform edge.
- Eyes drawn in normal position but pupils shifted upward (looking toward the climb target).

**Wall-cling:**
- Player body offset 2px from the wall surface (flush but not overlapping).
- `facingRight` set toward the wall.
- **Arm rectangles**: Two small body-colored rectangles (6×4 px) extend sideways from the player's side toward the wall, touching it.
- Eyes face toward the wall.

**Low-time pulse warning:**
- During the last 1 second of hang time (`grabHangTimer > grabHangDuration - 1000`), the player's body color brightness oscillates (sinusoidal pulse, cycle ~300ms) between normal and 30% brighter.
- P1 blue cycles: `#3498db` ↔ `#5dade2`. P2 red cycles: `#e74c3c` ↔ `#f1948a`.

**Climb-up animation (reused from existing `climbing` state):**
- During the ease-out lerp, arms retract and the player transitions to standing pose.
- Normal climb (160ms) vs depleted climb (100ms) — same animation, different speed.
- No new rendering needed — the existing climb lerp handles the Y transition.

### Timer Indicator

- A small depleting bar (20×4 px) rendered above the player's head during grab state.
- Color transitions: green (>66% remaining) → yellow (33-66%) → red (<33%).
- Width scales proportionally to remaining time.
- Not rendered if `hangTimeMs` is 0 (unlimited hang).

### Contact Spark Particles

- Brief burst of 4-6 small particles (3×3 px, white/yellow, lifetime ~300ms) emitted at the grab contact point when entering wall-cling or edge-hang.
- Particles spread in a small radius (10-15px) with random velocities and fade out quickly.
- Reuses the existing `Particles.js` system.

### Existing Indicator Repurposing

- The existing `ledgeGrabIndicator` (gold pulsing bar on vertical edge) is kept for the **pre-grab proximity indicator** — shown when the player is near a grabbable edge but hasn't yet triggered edge-hang (regardless of toward input).
- The existing `climbIndicator` (cyan pulsing line on top edge) is kept for wall-slide climb hints (non-grabbable walls or `grabbable: false` platforms).

---

## Interaction with Existing Systems

### Ledge-Grab Coexistence

The existing ledge-grab (auto-snap-on-top) is **preserved** and coexists with edge-hang. The mechanic chosen depends on input:

- **Pressing toward platform center + near edge → edge-hang** (grab mechanic)
- **No direction input + near edge → ledge-grab** (existing snap-on-top)
- **Holding down + near edge → neither** (pass through)

This means the existing ledge-grab code in `resolveCollisionAxisY` stays; edge-hang detection is inserted before it with the toward-input check.

### Moving Platforms

- When hanging/clinging on a moving platform, the player is carried along with it each frame using `getMovingPlatformState` dx/dy.
- Carry is applied at the start of the grab block, before any input-driven movement.
- If a moving platform carries the player into another solid surface, normal collision doesn't run (grab block returns early). This is an accepted limitation — level design should avoid this.

### Crumbling Platforms

- `updateCrumblingTimers` checks both grounded players AND grabbing players.
- Hanging/clinging on a crumbling platform activates the crumble timer (same `crumbleAfterMs` as standing).
- When a platform crumbles while being grabbed, the grab block releases the player into airborne state with `vy = 0`.
- Crumbling platforms default to 3-second hang time (`GRAB_CRUMBLING_HANG_TIME_MS = 3000`).

### Checkpoints

- No changes needed. Checkpoint collision (`aabbOverlap` + `touchCheckpoint`) is checked regardless of state.

### Death / Respawn

- `respawnAtCheckpoint` and `respawnAtSpawn` clear grab state fields (`grabbing = false`, `grabType = null`, `grabPlatformId = null`, etc.), same as they already clear `climbing` and `wallSlide`.

### Finish Zone

- Player must climb onto the platform to reach the finish zone. Hanging below it does not count — the finish check uses `aabbOverlap` which requires the player's AABB to intersect the finish zone.

### Phase Restriction

- Grab is disabled during `countdown` and `stageComplete` phases. During these phases, wall contact uses normal push-out and near-edge uses normal ledge-grab (no toward-input check).

---

## Physics Constants

New constants in `Physics.js`:

```js
export const GRAB_SHIMMY_SPEED = 150           // px/s — horizontal movement while edge-hanging
export const GRAB_SLOW_SLIDE_SPEED = 120       // px/s — descent speed in slow-slide hang mode
export const GRAB_DEFAULT_HANG_TIME_MS = 5000  // ms — default hang duration (5 seconds)
export const GRAB_CRUMBLING_HANG_TIME_MS = 3000 // ms — hang duration for crumbling platforms (3 seconds)
export const GRAB_EDGE_DETECT_THRESHOLD = 20   // px — max distance from platform top edge for edge-hang vs wall-cling
export const GRAB_CLIMB_DURATION = 160          // ms — normal climb-up animation duration
export const GRAB_CLIMB_DURATION_DEPLETED = 100 // ms — climb-up when hang timer < 1s remaining
export const GRAB_LOW_TIME_WARNING_MS = 1000    // ms — when pulse warning starts before auto-release
export const GRAB_RELEASE_VELOCITY = 10         // px/s — small downward velocity on release to prevent re-grab
```

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Both players grab same edge simultaneously | Both hang. Shimmy collision: if one shimmies into the other, the stationary player is pushed off. If both shimmy toward each other, both released. |
| Grab during climb animation (160ms) | Not possible. The `climbing` block returns early before the grab block runs. |
| Jump buffer triggers grab on contact frame | Buffer consumed immediately in grab block → instant climb-up or wall-jump. |
| Move platform carries grabber through wall | Player clips through. Accepted limitation; level design should avoid this. |
| Crumble during climb-up from grab | Climb animation completes normally. If platform crumbles after climb, player falls. |
| Player grabs crumbling platform while inactive | Grab not allowed (`isPlatformActive` false → no grab detection). |
| Slow-slide slides below platform bottom | Auto-release: `player.grabbing = false`, `player.vy = 10`. |
| Player grabs edge, presses down+left | Release takes priority (down always releases, regardless of other inputs). |
| Player at leftmost shimmy position, presses left | Clamped to `platform.x`. |
| Infinite hang (hangTimeMs = 0) with slow-slide | Player descends until sliding below platform bottom → auto-release. |
| Holding down airborne, contacts wall | No wall-cling. Normal push-out. Wall-slide can activate if pressing into wall. |
| Toward input but no edge nearby | Normal collision — no grab. If airborne + contact wall → wall-cling (wall-cling doesn't require toward input). |
| Downward catch: falling past edge + toward | Player grabs edge mid-fall. Timing window: when player center Y passes platform.y ± threshold. |
| Chain-grabbing: drop + re-grab below | Player presses down → releases → releases down → presses toward next edge → catches. Timing skill required. |
| Grab during countdown phase | Grab disabled. Normal collision only. |
| Depleted climb-up speed | If hang timer < 1s remaining, climb duration is 100ms instead of 160ms. |

---

## Files to Modify

| File | Changes |
|---|---|
| `entities/Player.js` | Add grab state fields to `createPlayer`; clear grab state in `respawnAtCheckpoint` / `respawnAtSpawn` |
| `engine/Physics.js` | Add all grab constants; add grab block after climbing block; modify `resolveCollisionAxis` for wall-cling detection (respect down-held skip); modify `resolveCollisionAxisY` to add edge-hang before ledge-grab (respect toward-input, down-held, downward catch); extend `updateCrumblingTimers` for grab check; handle moving platform carry for grab state; add player-player shimmy collision; add phase restriction check |
| `engine/Input.js` | No changes needed |
| `rendering/Renderer.js` | Add grab-specific rendering: arm rectangles, timer bar, pulse-on-low-time body color, contact spark particles, reposition sprite during grab |
| `rendering/Particles.js` | Add `emitGrabContactParticles(x, y)` function for contact spark effect |
| `levels/stage1.js` | Optionally add grab config overrides |
| `levels/stage2.js` | Optionally add grab config overrides |
| `levels/stage3.js` | Optionally add grab config overrides |
| `ParkourGame.jsx` | Pass phase to grab logic; pass player list for shimmy collision; render grab overlays |

---

## Testing Plan

### Unit Tests (new file: `engine/Grab.test.js`)

1. **Auto-grab on wall contact**: Player airborne + moving toward wall → enters wall-cling
2. **Down-held skips wall-cling**: Player airborne + holding down + contacts wall → no grab, normal push-out
3. **Edge-hang with toward input**: Player airborne + pressing toward platform center + near edge → enters edge-hang
4. **Ledge-grab without toward input**: Player airborne + no direction input + near edge → snap-on-top (existing behavior preserved)
5. **Down-held skips edge-hang**: Player airborne + holding down + near edge → no grab, pass through or head-bump
6. **Downward catch**: Player falling + pressing toward + near edge → enters edge-hang
7. **Pass-through edge-hang**: Player + toward input + near pass-through edge → enters edge-hang (does NOT pass through)
8. **Pass-through no wall-cling**: Player airborne + contacts pass-through side → passes through (no grab)
9. **Climb-up from cling**: Press jump while wall-cling → smooth climb animation → grounded on top
10. **Climb-up from hang**: Press jump while edge-hang → smooth climb animation → grounded on top
11. **Depleted climb-up speed**: Hang timer < 1s + press jump → 100ms climb (not 160ms)
12. **Wall jump off cling**: Press away + jump while wall-cling → launches away from wall
13. **Drop release**: Press down while grabbing → releases grab → airborne (vy=10)
14. **Away release**: Press away from platform while grabbing → releases grab → airborne
15. **Timer expiry**: Hang for `hangTimeMs` → auto-release → airborne
16. **Shimmy**: Press left/right while edge-hang → moves along edge at shimmy speed
17. **Shimmy clamp**: Shimmy past platform edge → clamped to bounds
18. **Shimmy collision push**: Player A shimmies into Player B on same edge → B released, A stays
19. **Mutual shimmy collision**: Both shimmy into each other → both released
20. **Moving platform carry**: Hang on moving platform → player moves with it
21. **Crumbling platform trigger**: Hang on crumbling platform → crumble timer starts
22. **Crumble release**: Platform crumbles while hanging → player released
23. **Slow-slide physics**: Platform with `hangPhysics: 'slow-slide'` → player descends while hanging
24. **Non-grabbable platform**: Platform with `grabbable: false` → no grab, wall-slide still works
25. **Death during grab**: Player dies while grabbing → grab state cleared on respawn
26. **Jump buffer on grab frame**: Press jump, then contact wall → immediate climb-up
27. **Grab disabled in countdown**: phase !== 'racing' → grab detection skipped
28. **Chain-grab sequence**: Drop from edge-hang, release down, press toward next edge → catches next edge
