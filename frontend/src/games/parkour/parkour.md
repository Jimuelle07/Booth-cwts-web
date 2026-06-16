# Parkour — Asset Spec

Asset requirements for the rebuilt race-to-the-top parkour game. (Replaces the
old sprite specs, which described the removed grab / wall-cling engine.) Today the
game draws characters as colored blobs and stage backgrounds as flat gradients —
these are the assets that would replace them.

## Coordinate facts (from the code)

- World is **420 units wide** (`WORLD_WIDTH` in `levels.js`); the camera only ever
  scrolls **vertically** and scales the whole 420-wide world to fit the panel width.
- On-screen scale ≈ panel width ÷ 420 (≈ **2.0–2.5×** on a typical half-screen).
- Player collision box: **30 wide × 34 tall** world units (`PLAYER_W` / `PLAYER_H`).
- Stage heights (bottom → top): Stage 1 = 1700, Stage 2 = 2300, Stage 3 = 2900 units.
- Finish line sits near the top at `finishY = 170`; players spawn at the bottom.

> **Deliver everything at 2× the world size** so it stays crisp at the on-screen
> scale. All sprites = transparent **PNG**. Default art **faces RIGHT** (the engine
> mirrors it for left movement).

---

## 1. Character sprites ("the character jumping")

Nine *Inside Out* characters (player picks one each). With the lean physics there
are only **four movement states** to cover — no climbing/grabbing/wall-slide:

| State | Frames | Notes |
|-------|--------|-------|
| **Idle** | 1–2 | standing, gentle breathe |
| **Run** | 4–6 | side-on running cycle (used while moving left/right on ground) |
| **Jump / rising** | 1 | body stretched up, legs tucked — shown while `vy < 0` |
| **Fall** | 1 | arms up / bracing — shown while `vy > 0` and airborne |
| *(optional)* **Land squash** | 1 | flattened, played for a few frames on touchdown |

So a minimum **7–9 frames per character** covers everything (12 if you add the
optional land + a longer run).

**Per-frame canvas:** **64 × 64 px** content area on a **96 × 96 px** frame
(2× of the 30×34 box leaves headroom for jump stretch and a squash). Character
**feet aligned to the bottom** of the box, body horizontally centered.

**Layout:** one horizontal sprite sheet per character (e.g. `joy.png`, 96×96 cells
in a row), or individual PNGs. Tell me which and I'll wire the frame-picker.

**Style:** bright, rounded, readable at ~60px tall, thick outline, top-left light.
Use each character's signature color as the dominant body color:

| Character | Hex | Character | Hex |
|-----------|------|-----------|------|
| Joy | `#FFD700` | Anxiety | `#E67E22` |
| Sadness | `#4A90D9` | Envy | `#1ABC9C` |
| Anger | `#E03B1F` | Embarrassment | `#E91E8C` |
| Fear | `#9B59B6` | Ennui | `#4A5ADB` |
| Disgust | `#27AE60` | | |

*(Anger and Ennui already have portrait art under `assets/` — match that look.)*

If full sheets are too much up front, the cheapest useful drop is **one idle +
one jump frame per character** (18 PNGs); I can animate run by squash/stretch in
code until real run frames arrive.

---

## 2. Stage backgrounds (one per stage)

Each stage is a tall vertical climb with a theme. Today each is just a 2-color sky
gradient (`THEMES` in `levels.js`); art would sit behind the platforms.

**Format options (pick one):**
- **A — Seamless vertical tile (recommended):** a **840 px wide × ~1024 px tall**
  PNG that tiles seamlessly top-to-bottom, scrolled with the camera. Cheapest,
  works for any stage height. Optionally add a separate **top cap** (finish/sky)
  and **bottom cap** (ground/start) image, ~840×512 each.
- **B — One tall image per stage:** full height at 2× → Stage 1 ≈ 840×3400,
  Stage 2 ≈ 840×4600, Stage 3 ≈ 840×5800 px. Most control, large files.
- **C — Parallax layers:** 2–3 transparent layers (far / mid) each 840 wide,
  scrolling at different speeds. Nicest depth, most work.

**Per-stage art direction** (keep the existing color mood so it reads as
"getting harder / dreamier" as you climb):

| Stage | Theme key | Mood / colors | Subject ideas |
|-------|-----------|---------------|---------------|
| 1 · Headquarters | `joy` | warm gold, sunny (`#fff4c2` → `#ffd65c`) | inside HQ / memory-orb shelves, cheerful, bright |
| 2 · Cloud Town | `sad` | cool blue, airy (`#cfe6ff` → `#7fb2e8`) | Imagination-Land cloud city, soft clouds, daylight |
| 3 · Imagination Peak | `fear` | dusky purple, dreamlike (`#2a2350` → `#5a4a9c`) | abstract dream/subconscious, starry, moody |

Lower portion of each bg = brighter/grounded; **top fades toward the finish** so
the goal feels like a summit.

---

## 3. (Optional) Platform surface art

Platforms/clouds/trees are currently drawn as vector shapes and look fine, but if
you want art they're small sprites, **stretched horizontally** to each platform's
width (so make them tileable left↔right or use 9-slice). At 2×:

- **`platform`** — solid ledge, ~256×48 px, brown/grass top edge.
- **`cloud`** — fluffy puff, ~256×56 px (it fades when stood on — keep it soft).
- **`tree`** — springy branch + foliage cap, ~256×56 px, green.

---

## What to hand me & I'll wire it

1. **Characters:** 9 PNGs/sheets (or the minimal idle+jump set). Say sheet-vs-files
   and frame size and I'll hook up the animation in `drawPlayer`.
2. **Backgrounds:** 3 images (option A/B/C). I'll replace the gradient in the render
   loop and add scrolling/parallax.
3. **Platforms (optional):** the 3 surface PNGs.

Drop them in `frontend/src/games/parkour/assets/` and tell me the filenames.
