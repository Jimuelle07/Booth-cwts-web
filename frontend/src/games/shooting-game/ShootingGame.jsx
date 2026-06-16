import { useEffect, useRef, useCallback, useState } from 'react'
import bgSrc from './assets/background.png'
import ShootingGameAudio from './utils/audio'
import { CHARACTERS } from '../../components/landing_page/CharacterSelect'
import useGameStore from '../../store/useGameStore'
import EndCredits from '../../components/EndCredits'
import useShootingStore from './useShootingStore'

// ─── SPRITE LOADING ─────────────────────────────────────────────────
// Auto-import all PNG sprites from the assets directory.
const spriteModules = import.meta.glob(
  ['./assets/*.png', '!./assets/background.png'],
  { eager: true, import: 'default' }
)
function getSprite(name) {
  return spriteModules['./assets/' + name] || ''
}

const CHARACTER_SPRITES = {
  joy: getSprite('joy.png'),
  sadness: getSprite('sadness.png'),
  anger: getSprite('anger.png'),
  fear: getSprite('fear.png'),
  disgust: getSprite('disgust.png'),
  anxiety: getSprite('anxiety.png'),
  envy: getSprite('envy.png'),
  embarrassment: getSprite('embarrassment.png'),
  ennui: getSprite('ennui.png'),
}

const ENEMY_SPRITES = {
  scout: getSprite('enemy_scout.png'),
  strafer: getSprite('enemy_strafer.png'),
  bomber: getSprite('enemy_bomber.png'),
}

const BOSS_SPRITES = {
  burnout: getSprite('boss_burnout.png'),
  perfectionism: getSprite('boss_perfectionism.png'),
  despair: getSprite('boss_despair.png'),
}

// ─── CHARACTER DEFINITIONS ──────────────────────────────────────────
const CHARACTER_STATS = {
  joy: {
    name: 'Joy',
    color: '#FFD700',
    bulletColor: '#FFE066',
    fireRate: 12,       // every 12 frames (~5/sec) — solid rapid fire
    speed: 4,
    lives: 4,
    bulletSpeed: 9,
    bulletDamage: 1,
    magnetRadius: 1.5,
    perk: 'extra-life-magnet',
    weaponType: 'rapid',
  },
  anger: {
    name: 'Anger',
    color: '#FF4444',
    bulletColor: '#FF6633',
    fireRate: 22,       // slow but heavy fireballs
    speed: 4,
    lives: 3,
    bulletSpeed: 7,
    bulletDamage: 2,
    magnetRadius: 1,
    perk: 'rage-mode',
    weaponType: 'fireball',
  },
  sadness: {
    name: 'Sadness',
    color: '#4488FF',
    bulletColor: '#66BBFF',
    fireRate: 20,       // spread is 3 bullets so compensate with slower rate
    speed: 4,
    lives: 3,
    bulletSpeed: 7,
    bulletDamage: 1,    // nerfed: 3-wide spread is already coverage
    magnetRadius: 1,
    perk: 'bubble-shield',
    weaponType: 'spread',
  },
  fear: {
    name: 'Fear',
    color: '#BB66FF',
    bulletColor: '#DD88FF',
    fireRate: 24,       // homing is strong so fires slowly
    speed: 4,
    lives: 3,
    bulletSpeed: 5,     // slow homing — can be dodged by enemies moving fast
    bulletDamage: 1,    // nerfed: homing does the work
    magnetRadius: 1,
    perk: 'small-hitbox',
    weaponType: 'homing',
  },
  disgust: {
    name: 'Disgust',
    color: '#44CC44',
    bulletColor: '#66FF66',
    fireRate: 16,       // piercing beam, moderate rate
    speed: 4,
    lives: 3,
    bulletSpeed: 11,
    bulletDamage: 1,
    magnetRadius: 1,
    perk: 'toxic-contact',
    weaponType: 'beam',
  },
  anxiety: {
    name: 'Anxiety',
    color: '#FF8800',
    bulletColor: '#FFAA33',
    fireRate: 14,       // zigzag single shot
    speed: 4,
    lives: 3,
    bulletSpeed: 8,
    bulletDamage: 1,
    magnetRadius: 1,
    perk: 'danger-sense',
    weaponType: 'zigzag',
  },
  envy: {
    name: 'Envy',
    color: '#00CCAA',
    bulletColor: '#44FFDD',
    fireRate: 18,       // dual lane, moderate
    speed: 4,
    lives: 3,
    bulletSpeed: 8,
    bulletDamage: 1,    // nerfed: two bullets per shot
    magnetRadius: 1,
    perk: 'drone-helper',
    weaponType: 'dual',
  },
  embarrassment: {
    name: 'Embarrassment',
    color: '#FF66AA',
    bulletColor: '#FF88CC',
    fireRate: 30,       // wide shockwave, very slow
    speed: 4,
    lives: 3,
    bulletSpeed: 5,
    bulletDamage: 2,    // nerfed from 3: wide piercing is already strong
    magnetRadius: 1,
    perk: 'long-invincibility',
    weaponType: 'shockwave',
  },
  ennui: {
    name: 'Ennui',
    color: '#8888AA',
    bulletColor: '#AAAACC',
    fireRate: 28,       // auto-fire homing — kept slow since it's hands-free
    speed: 4,
    lives: 3,
    bulletSpeed: 4,     // slow homing drift
    bulletDamage: 1,    // nerfed from 2
    magnetRadius: 1,
    perk: 'auto-fire',
    weaponType: 'auto-pulse',
  },
}

const DEFAULT_STATS = CHARACTER_STATS.joy

// ─── CONSTANTS ──────────────────────────────────────────────────────
const CANVAS_W = 800
const CANVAS_H = 700
const JET_W = 48
const JET_H = 64
const BG_SCROLL_SPEED = 1.2
const STAR_COUNT = 60
const INVINCIBILITY_FRAMES = 90 // 1.5s at 60fps
const LONG_INVINCIBILITY_FRAMES = 180 // 3s
const ENEMY_SPAWN_INTERVAL_BASE = 80 // frames
const POWER_UP_DROP_CHANCE = 0.15

// ─── DIFFICULTY PRESETS ─────────────────────────────────────────────
const DIFFICULTY_PRESETS = {
  easy: {
    label: 'Easy',
    enemySpeedMult: 0.75,
    spawnIntervalBase: 120,
    enemyFireRateMult: 0.7,
    bossHpMult: 0.7,
    bossSpeedMult: 0.8,
    bossFireRateMult: 0.7,
    color: '#44CC88',
    startingHearts: 7,
    playerSpeedMult: 1.0,
  },
  medium: {
    label: 'Medium',
    enemySpeedMult: 1.0,
    spawnIntervalBase: 80,
    enemyFireRateMult: 1.0,
    bossHpMult: 1.0,
    bossSpeedMult: 1.0,
    bossFireRateMult: 1.0,
    color: '#FFAA33',
    startingHearts: 6,
    playerSpeedMult: 1.0,
  },
  hard: {
    label: 'Hard',
    enemySpeedMult: 1.3,
    spawnIntervalBase: 50,
    enemyFireRateMult: 1.4,
    bossHpMult: 1.4,
    bossSpeedMult: 1.3,
    bossFireRateMult: 1.4,
    color: '#FF4455',
    startingHearts: 5,
    playerSpeedMult: 0.9,
  },
}

const BOSS_DEFINITIONS = [
  {
    type: 'burnout',
    name: 'BURNOUT',
    scoreThreshold: 1000,
    hp: 75,        // Wave 1 boss — moderate
    speed: 1.5,
    fireRate: 38,  // frames between volleys (higher = slower fire = easier)
    scoreValue: 500,
    color: '#FF2266',
    w: 120,
    h: 80,
  },
  {
    type: 'perfectionism',
    name: 'PERFECTIONISM',
    scoreThreshold: 2500,
    hp: 110,       // Wave 2 — scaled further by lvlScale
    speed: 2,
    fireRate: 30,
    scoreValue: 800,
    color: '#00DDFF',
    w: 130,
    h: 90,
  },
  {
    type: 'despair',
    name: 'DESPAIR',
    scoreThreshold: 4500,
    hp: 150,       // Wave 3 — scaled hardest
    speed: 1.2,
    fireRate: 34,
    scoreValue: 1200,
    color: '#4488FF',
    w: 140,
    h: 100,
  },
]

// ─── HELPERS ────────────────────────────────────────────────────────
function rand(min, max) {
  return Math.random() * (max - min) + min
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1))
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
function aabbCollision(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  )
}
function lerp(a, b, t) {
  return a + (b - a) * t
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────
export default function ShootingGame({ canvasId, player1, player2, pressedKeys }) {
  const canvasRef = useRef(null)
  const gameStateRef = useRef(null)
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [p1Diff, setP1Diff] = useState(null)
  const [p2Diff, setP2Diff] = useState(null)

  // ── Audio manager (one per panel, lazy-init) ──
  useEffect(() => {
    audioRef.current = new ShootingGameAudio()
    return () => {
      if (audioRef.current) {
        audioRef.current.dispose()
        audioRef.current = null
      }
    }
  }, [])

  // Determine which side this panel is for based on canvasId
  const isLeftPanel = canvasId === 'canvas-left'
  const playerData = isLeftPanel ? player1 : player2
  const oppData = isLeftPanel ? player2 : player1
  const myKey = isLeftPanel ? 'player1' : 'player2'
  const oppKey = isLeftPanel ? 'player2' : 'player1'

  const setPhase = useGameStore((s) => s.setPhase)

  // Shared match coordination — the end credits roll only once BOTH pilots fall.
  const matchWinner = useShootingStore((s) => s.winner)
  const myFinished = useShootingStore((s) => s[myKey].finished)
  const myFinalScore = useShootingStore((s) => s[myKey].score)
  const oppFinalScore = useShootingStore((s) => s[oppKey].score)

  // Keep shared state alive while either panel is mounted.
  useEffect(() => {
    useShootingStore.getState().mount()
    return () => useShootingStore.getState().unmount()
  }, [])

  // ── Sync level selection ──
  useEffect(() => {
    const handleSync = (e) => {
      const { player, level } = e.detail;
      if (player === 1) setP1Diff(level);
      if (player === 2) setP2Diff(level);
    };
    const handleStartSync = () => setIsPlaying(true);
    window.addEventListener('shooting-level-sync', handleSync);
    window.addEventListener('shooting-start-sync', handleStartSync);
    return () => {
      window.removeEventListener('shooting-level-sync', handleSync);
      window.removeEventListener('shooting-start-sync', handleStartSync);
    };
  }, []);

  const selectDifficulty = (level) => {
    window.dispatchEvent(new CustomEvent('shooting-level-sync', { detail: { player: 1, level } }));
    window.dispatchEvent(new CustomEvent('shooting-level-sync', { detail: { player: 2, level } }));
    setP1Diff(level);
    setP2Diff(level);
    // Play select beep (also inits AudioContext on first user click)
    if (audioRef.current) {
      audioRef.current.ensureContext()
      audioRef.current.playSelect()
    }
  }

  const currentDiff = isLeftPanel ? p1Diff : p2Diff;
  const bothAgreed = p1Diff && p2Diff && (p1Diff === p2Diff);

  const getCharacterStats = useCallback(() => {
    const key = playerData?.avatarKey || 'joy'
    return CHARACTER_STATS[key] || DEFAULT_STATS
  }, [playerData])

  // ── Shoot-key to launch from menu ──
  useEffect(() => {
    if (isPlaying || !bothAgreed) return
    const shootKeys = isLeftPanel
      ? ['g']
      : ["'", '5']
    function checkShootKey() {
      for (const k of shootKeys) {
        if (pressedKeys.has(k) || pressedKeys.has(k.toUpperCase())) {
          setIsPlaying(true)
          return
        }
      }
    }
    const interval = setInterval(checkShootKey, 100)
    return () => clearInterval(interval)
  }, [isPlaying, isLeftPanel, pressedKeys, bothAgreed])

  useEffect(() => {
    if (!isPlaying) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const diff = DIFFICULTY_PRESETS[currentDiff] || DIFFICULTY_PRESETS.medium

    // ── Asset loading ──
    const bgImg = new Image()
    bgImg.src = bgSrc

    // Character sprite (selected emotion)
    const charKey = playerData?.avatarKey || 'joy'
    const characterImg = new Image()
    if (CHARACTER_SPRITES[charKey]) characterImg.src = CHARACTER_SPRITES[charKey]

    // Enemy sprites
    const enemyImgs = {}
    for (const [type, src] of Object.entries(ENEMY_SPRITES)) {
      const img = new Image()
      if (src) img.src = src
      enemyImgs[type] = img
    }

    // Boss sprites
    const bossImgs = {}
    for (const [type, src] of Object.entries(BOSS_SPRITES)) {
      const img = new Image()
      if (src) img.src = src
      bossImgs[type] = img
    }

    // ── Key mapping ──
    const keys = isLeftPanel
      ? { up: 'w', down: 's', left: 'a', right: 'd', shoot: 'g' }
      : {
        up: 'i',
        upAlt: 'ArrowUp',
        down: 'k',
        downAlt: 'ArrowDown',
        left: 'j',
        leftAlt: 'ArrowLeft',
        right: 'l',
        rightAlt: 'ArrowRight',
        shoot: "'",
        shootAlt: '5',
        shootAlt2: '/',
      }

    // Match a key regardless of Caps Lock / Shift: keydown reports `e.key` as
    // 'W' instead of 'w' when caps is on, so check both cases (same defensive
    // pattern the tug-of-war and bowling games already use).
    function isKeyDown(key) {
      if (!key) return false
      return pressedKeys.has(key) || pressedKeys.has(key.toUpperCase()) || pressedKeys.has(key.toLowerCase())
    }

    function isKeyPressed(action) {
      return (
        isKeyDown(keys[action]) ||
        isKeyDown(keys[action + 'Alt']) ||
        isKeyDown(keys[action + 'Alt2'])
      )
    }

    // ── Game state initialization ──
    const stats = getCharacterStats()

    function createGameState() {
      const stars = []
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: rand(0, CANVAS_W),
          y: rand(0, CANVAS_H),
          size: rand(0.5, 2.5),
          speed: rand(0.3, 1.5),
          brightness: rand(0.3, 1),
        })
      }

      return {
        player: {
          x: CANVAS_W / 2 - JET_W / 2,
          y: CANVAS_H - JET_H - 30,
          w: JET_W,
          h: JET_H,
          lives: diff.startingHearts,
          score: 0,
          invincibleTimer: 0,
          fireCooldown: 0,
          rageTimer: 0,
          bubbleShieldCooldown: 0,
          doubleShot: false,
          doubleShotTimer: 0,
          shieldActive: false,
          shieldTimer: 0,
          hitboxShrink: stats.perk === 'small-hitbox' ? 0.7 : 1,
        },
        drone:
          stats.perk === 'drone-helper'
            ? { x: CANVAS_W / 2 - JET_W / 2 - 20, y: CANVAS_H - JET_H - 20, fireCooldown: 0 }
            : null,
        bgScrollY: 0,
        stars,
        bullets: [],
        enemies: [],
        enemyBullets: [],
        particles: [],
        explosions: [],
        powerUps: [],
        scoreFloaters: [],
        dangerWarnings: [],
        boss: null,
        bossesDefeated: 0,
        bossIncoming: null,      // bossIndex being warned about, or null
        bossIncomingTimer: 0,    // countdown frames before boss spawns
        enemySpawnTimer: 0,
        frame: 0,
        shakeX: 0,
        shakeY: 0,
        shakeDuration: 0,
        gameOver: false,
        gameOverTimer: 0,
        finishReported: false,
        combo: 0,
        comboTimer: 0,
      }
    }

    let gs = createGameState()
    gameStateRef.current = gs
    // Track the shared round counter so a "Play Again" from the end credits
    // (which bumps the round) rebuilds this panel's local game state.
    let seenRound = useShootingStore.getState().round

    // Fast hex-to-rgba converter for drawing semi-transparent elements without canvas context flushes
    function fillStyleForColor(color, alpha) {
      if (color.startsWith('#')) {
        let c = color.slice(1)
        if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
        const r = parseInt(c.slice(0, 2), 16)
        const g = parseInt(c.slice(2, 4), 16)
        const b = parseInt(c.slice(4, 6), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
      }
      return color
    }

    // ── Particle factory ──
    function spawnParticles(x, y, color, count, speedMult = 1) {
      // Hard cap to prevent lag during heavy explosions
      if (gs.particles.length > 110) return
      for (let i = 0; i < count; i++) {
        gs.particles.push({
          x,
          y,
          vx: rand(-2, 2) * speedMult,
          vy: rand(-3, 1) * speedMult,
          life: rand(15, 40),
          maxLife: 40,
          color,
          size: rand(1.5, 4),
        })
      }
    }

    function spawnExplosion(x, y, size = 1) {
      gs.explosions.push({
        x,
        y,
        radius: 0,
        maxRadius: 30 * size,
        life: 20,
        maxLife: 20,
      })
      const colors = ['#FF4400', '#FF8800', '#FFCC00', '#FFFFFF']
      for (const c of colors) {
        spawnParticles(x, y, c, Math.floor(4 * size), 1.5)
      }
    }

    function spawnScoreFloater(x, y, points) {
      gs.scoreFloaters.push({
        x,
        y,
        text: `+${points}`,
        life: 50,
        maxLife: 50,
      })
    }

    function applyScreenShake(intensity, duration) {
      gs.shakeDuration = duration
      gs.shakeX = rand(-intensity, intensity)
      gs.shakeY = rand(-intensity, intensity)
    }

    // ── Bullet creation ──
    function createBullet(x, y, overrides = {}) {
      return {
        x,
        y,
        w: 4,
        h: 12,
        vy: -(overrides.speed || stats.bulletSpeed),
        vx: overrides.vx || 0,
        damage: overrides.damage || stats.bulletDamage,
        color: overrides.color || stats.bulletColor,
        homing: overrides.homing || false,
        piercing: overrides.piercing || false,
        zigzag: overrides.zigzag || false,
        zigzagTimer: 0,
        aoe: overrides.aoe || false,
        aoeRadius: overrides.aoeRadius || 0,
        slow: overrides.slow || false,
        ...overrides,
        // Ensure vy is always negative (going up) unless explicitly overridden
        vy: -(overrides.speed || stats.bulletSpeed),
      }
    }

    function fireWeapon(px, py) {
      const s = stats
      const isRaging = gs.player.rageTimer > 0
      const dmgMult = isRaging ? 2 : 1
      const rateMult = isRaging ? 0.5 : 1

      if (gs.player.fireCooldown > 0) return
      gs.player.fireCooldown = Math.max(3, Math.floor(s.fireRate * rateMult))
      // 🔊 Shoot sound
      if (audioRef.current) audioRef.current.playShoot(s.weaponType)

      const cx = px + JET_W / 2
      const cy = py

      switch (s.weaponType) {
        case 'rapid': {
          gs.bullets.push(createBullet(cx - 2, cy, { damage: s.bulletDamage * dmgMult }))
          if (gs.player.doubleShot) {
            gs.bullets.push(createBullet(cx - 10, cy, { damage: s.bulletDamage * dmgMult }))
            gs.bullets.push(createBullet(cx + 6, cy, { damage: s.bulletDamage * dmgMult }))
          }
          break
        }
        case 'fireball': {
          gs.bullets.push(
            createBullet(cx - 3, cy, {
              w: 8,
              h: 8,
              damage: s.bulletDamage * dmgMult,
              color: '#FF4400',
              aoe: true,
              aoeRadius: 40,
            })
          )
          break
        }
        case 'spread': {
          for (let angle = -0.3; angle <= 0.3; angle += 0.3) {
            gs.bullets.push(
              createBullet(cx - 2, cy, {
                vx: Math.sin(angle) * 3,
                damage: s.bulletDamage * dmgMult,
                slow: true,
              })
            )
          }
          break
        }
        case 'homing': {
          gs.bullets.push(
            createBullet(cx - 2, cy, {
              w: 6,
              h: 6,
              damage: s.bulletDamage * dmgMult,
              homing: true,
              color: '#DD88FF',
            })
          )
          break
        }
        case 'beam': {
          gs.bullets.push(
            createBullet(cx - 3, cy, {
              w: 5,
              h: 16,
              damage: s.bulletDamage * dmgMult,
              piercing: true,
              color: '#66FF66',
              speed: 11,
            })
          )
          break
        }
        case 'zigzag': {
          gs.bullets.push(
            createBullet(cx - 2, cy, {
              damage: s.bulletDamage * dmgMult,
              zigzag: true,
              color: '#FFAA33',
            })
          )
          if (gs.player.doubleShot) {
            gs.bullets.push(
              createBullet(cx + 6, cy, {
                damage: s.bulletDamage * dmgMult,
                zigzag: true,
                color: '#FFAA33',
              })
            )
          }
          break
        }
        case 'dual': {
          gs.bullets.push(createBullet(cx - 10, cy, { damage: s.bulletDamage * dmgMult }))
          gs.bullets.push(createBullet(cx + 6, cy, { damage: s.bulletDamage * dmgMult }))
          break
        }
        case 'shockwave': {
          gs.bullets.push(
            createBullet(cx - 8, cy - 5, {
              w: 18,
              h: 14,
              damage: s.bulletDamage * dmgMult,
              speed: 5,
              color: '#FF88CC',
              piercing: true,
            })
          )
          break
        }
        case 'auto-pulse': {
          gs.bullets.push(
            createBullet(cx - 2, cy, {
              damage: s.bulletDamage * dmgMult,
              homing: true,
              color: '#AAAACC',
              speed: 5,
            })
          )
          break
        }
        default: {
          gs.bullets.push(createBullet(cx - 2, cy, { damage: s.bulletDamage * dmgMult }))
        }
      }
    }

    // ── Enemy factory (difficulty-scaled) ──
    function spawnEnemy(type, x) {
      const base = {
        x: x ?? rand(20, CANVAS_W - 50),
        y: -40,
        flashTimer: 0,
      }
      // Wave bonus: +15% speed per defeated boss — enemies keep escalating
      const waveBonus = 1 + gs.bossesDefeated * 0.15
      const sm = diff.enemySpeedMult * waveBonus
      const fm = diff.enemyFireRateMult

      switch (type) {
        case 'scout':
          return {
            ...base,
            type: 'scout',
            w: 28,
            h: 28,
            hp: 2,
            maxHp: 2,
            speed: rand(2, 3.5) * sm,
            vx: 0,
            color: '#FF5555',
            scoreValue: 50,
            fireCooldown: 0,
            fireRate: 0,
            bulletShape: 'triangle',
            bulletColor: '#FF5555',
          }
        case 'strafer':
          return {
            ...base,
            type: 'strafer',
            w: 32,
            h: 32,
            hp: 4,
            maxHp: 4,
            speed: rand(1.5, 2.5) * sm,
            vx: (rand(-1.5, 1.5) || 0.5) * sm,
            color: '#FF8833',
            scoreValue: 100,
            fireCooldown: randInt(80, 140),
            fireRate: Math.floor(90 / fm),
            bulletShape: 'diamond',
            bulletColor: '#FF8833',
          }
        case 'bomber':
          return {
            ...base,
            type: 'bomber',
            w: 48,
            h: 44,
            hp: 8,
            maxHp: 8,
            speed: rand(0.7, 1.2) * sm,
            vx: 0,
            color: '#AA44FF',
            scoreValue: 200,
            fireCooldown: randInt(70, 120),
            fireRate: Math.floor(70 / fm),
            bulletShape: 'orb',
            bulletColor: '#FF44FF',
          }
        default:
          return {
            ...base,
            type: 'scout',
            w: 28,
            h: 28,
            hp: 2,
            maxHp: 2,
            speed: 2 * sm,
            vx: 0,
            color: '#FF5555',
            scoreValue: 50,
            fireCooldown: 0,
            fireRate: 0,
            bulletShape: 'triangle',
            bulletColor: '#FF5555',
          }
      }
    }

    function spawnBoss(bossIndex) {
      const cycleSize = BOSS_DEFINITIONS.length
      const defIdx = bossIndex % cycleSize
      const cycle = Math.floor(bossIndex / cycleSize)
      const def = BOSS_DEFINITIONS[defIdx]
      if (!def) return

      // Progressive per-boss scaling — each boss is meaningfully harder than the last
      const LVL_SCALE = [
        { hp: 1.0, speed: 1.0, fire: 1.0 },  // Wave 1 — baseline
        { hp: 1.55, speed: 1.28, fire: 1.28 },  // Wave 2 — notably tougher
        { hp: 2.3, speed: 1.6, fire: 1.55 },  // Wave 3 — brutal
      ]
      const scale = LVL_SCALE[defIdx] ?? LVL_SCALE[2]

      // Cycle multipliers for bosses in successive loops
      const cycleHpMult = 1 + cycle * 0.45       // +45% HP per loop cycle
      const cycleSpeedMult = 1 + cycle * 0.12    // +12% speed per loop cycle
      const cycleFireMult = 1 + cycle * 0.10     // +10% faster fire rate per loop cycle

      const bossHp = Math.floor(def.hp * diff.bossHpMult * scale.hp * cycleHpMult)
      const bossSpeed = def.speed * diff.bossSpeedMult * scale.speed * cycleSpeedMult
      const bossFireRate = Math.max(8, Math.floor(def.fireRate / (diff.bossFireRateMult * scale.fire * cycleFireMult)))
      gs.boss = {
        type: def.type,
        name: `${def.name} ${cycle > 0 ? 'V' + (cycle + 1) : ''}`,
        x: CANVAS_W / 2 - def.w / 2,
        y: -def.h - 40,
        w: def.w,
        h: def.h,
        hp: bossHp,
        maxHp: bossHp,
        speed: bossSpeed,
        vx: bossSpeed,
        entering: true,
        targetY: 50,
        fireCooldown: 0,
        fireRate: bossFireRate,
        flashTimer: 0,
        scoreValue: Math.floor(def.scoreValue * (1 + cycle * 0.5)),
        color: def.color,
      }
    }

    // ── Power-up factory ──
    function spawnPowerUp(x, y) {
      const types = ['shield', 'double-shot', 'heal']
      const type = types[randInt(0, types.length - 1)]
      const colors = { shield: '#44DDFF', 'double-shot': '#FFAA00', heal: '#44FF44' }
      const symbols = { shield: '🛡', 'double-shot': '⚡', heal: '❤' }
      gs.powerUps.push({
        x,
        y,
        w: 20,
        h: 20,
        type,
        color: colors[type],
        symbol: symbols[type],
        vy: 2.5,                      // faster fall — clearly drops down
        vx: rand(-0.6, 0.6),          // slight horizontal drift
      })
    }

    // ── Player damage ──
    function damagePlayer() {
      if (gs.player.invincibleTimer > 0 || gs.player.shieldActive) {
        if (gs.player.shieldActive) {
          gs.player.shieldActive = false
          gs.player.shieldTimer = 0
          spawnParticles(
            gs.player.x + JET_W / 2,
            gs.player.y + JET_H / 2,
            '#44DDFF',
            15,
            2
          )
        }
        return
      }
      // Bubble shield from Sadness
      if (stats.perk === 'bubble-shield' && gs.player.bubbleShieldCooldown <= 0) {
        gs.player.bubbleShieldCooldown = 60 * 25 // 25 seconds
        spawnParticles(
          gs.player.x + JET_W / 2,
          gs.player.y + JET_H / 2,
          '#66BBFF',
          15,
          2
        )
        applyScreenShake(3, 8)
        return
      }

      gs.player.lives--
      gs.player.invincibleTimer =
        stats.perk === 'long-invincibility'
          ? LONG_INVINCIBILITY_FRAMES
          : INVINCIBILITY_FRAMES

      applyScreenShake(6, 15)
      spawnParticles(
        gs.player.x + JET_W / 2,
        gs.player.y + JET_H / 2,
        '#FF4444',
        12,
        2
      )
      // 🔊 Player damage sound
      if (audioRef.current) audioRef.current.playDamage()

      // Rage mode for Anger
      if (stats.perk === 'rage-mode') {
        gs.player.rageTimer = 180 // 3 seconds
      }

      if (gs.player.lives <= 0) {
        gs.gameOver = true
        spawnExplosion(gs.player.x + JET_W / 2, gs.player.y + JET_H / 2, 2)
        // 🔊 Game over sound
        if (audioRef.current) audioRef.current.playGameOver()
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // UPDATE
    // ══════════════════════════════════════════════════════════════════
    function update() {
      if (gs.gameOver) {
        // Report this pilot's final score exactly once so the shared store can
        // resolve the match the moment both players have fallen.
        if (!gs.finishReported) {
          gs.finishReported = true
          useShootingStore.getState().reportFinish(myKey, gs.player.score)
        }
        gs.gameOverTimer++
        // Still update particles/explosions for visual flair
        updateParticles()
        return
      }

      gs.frame++
      const p = gs.player

      // ── Timers ──
      if (p.fireCooldown > 0) p.fireCooldown--
      if (p.invincibleTimer > 0) p.invincibleTimer--
      if (p.rageTimer > 0) p.rageTimer--
      if (p.bubbleShieldCooldown > 0) p.bubbleShieldCooldown--
      if (p.doubleShotTimer > 0) {
        p.doubleShotTimer--
        if (p.doubleShotTimer <= 0) p.doubleShot = false
      }
      if (p.shieldTimer > 0) {
        p.shieldTimer--
        if (p.shieldTimer <= 0) p.shieldActive = false
      }
      if (gs.comboTimer > 0) {
        gs.comboTimer--
        if (gs.comboTimer <= 0) gs.combo = 0
      }

      // ── Player movement ──
      let moveSpeed = stats.speed * diff.playerSpeedMult
      if (stats.perk === 'long-invincibility' && p.invincibleTimer > 0) {
        moveSpeed *= 1.2
      }
      if (isKeyPressed('up')) p.y -= moveSpeed
      if (isKeyPressed('down')) p.y += moveSpeed
      if (isKeyPressed('left')) p.x -= moveSpeed
      if (isKeyPressed('right')) p.x += moveSpeed
      p.x = clamp(p.x, 0, CANVAS_W - JET_W)
      p.y = clamp(p.y, 0, CANVAS_H - JET_H)

      // ── Shooting ──
      if (stats.perk === 'auto-fire' || isKeyPressed('shoot')) {
        fireWeapon(p.x, p.y)
      }

      // ── Drone helper (Envy) ──
      if (gs.drone) {
        gs.drone.x = lerp(gs.drone.x, p.x - 20, 0.08)
        gs.drone.y = lerp(gs.drone.y, p.y + 10, 0.08)
        if (gs.drone.fireCooldown > 0) gs.drone.fireCooldown--
        if (gs.drone.fireCooldown <= 0) {
          gs.drone.fireCooldown = 18
          gs.bullets.push(
            createBullet(gs.drone.x + 6, gs.drone.y, {
              damage: stats.bulletDamage * 0.5,
              color: '#44FFDD',
              speed: 7,
              w: 3,
              h: 8,
            })
          )
        }
      }

      // ── Scrolling background ──
      gs.bgScrollY += BG_SCROLL_SPEED
      for (const star of gs.stars) {
        star.y += star.speed
        if (star.y > CANVAS_H) {
          star.y = 0
          star.x = rand(0, CANVAS_W)
        }
      }

      // ── Update bullets ──
      for (let i = gs.bullets.length - 1; i >= 0; i--) {
        const b = gs.bullets[i]
        b.y += b.vy
        b.x += b.vx || 0

        if (b.zigzag) {
          b.zigzagTimer++
          b.x += Math.sin(b.zigzagTimer * 0.3) * 2.5
        }

        if (b.homing) {
          let nearest = null
          let nearestDist = Infinity
          for (const e of gs.enemies) {
            const d = dist(b, { x: e.x + e.w / 2, y: e.y + e.h / 2 })
            if (d < nearestDist) {
              nearestDist = d
              nearest = e
            }
          }
          if (gs.boss && !gs.boss.entering) {
            const d = dist(b, {
              x: gs.boss.x + gs.boss.w / 2,
              y: gs.boss.y + gs.boss.h / 2,
            })
            if (d < nearestDist) {
              nearest = gs.boss
            }
          }
          if (nearest) {
            const tx = nearest.x + nearest.w / 2 - b.x
            const ty = nearest.y + nearest.h / 2 - b.y
            const len = Math.hypot(tx, ty) || 1
            // Turn sharper when close to target to prevent infinite orbiting loop
            const turnStrength = len < 45 ? 0.22 : 0.06
            b.vx = lerp(b.vx || 0, (tx / len) * 4, turnStrength)
            b.vy = lerp(b.vy, (ty / len) * Math.abs(b.vy || stats.bulletSpeed), turnStrength)
          }
        }

        if (b.y < -20 || b.y > CANVAS_H + 20 || b.x < -20 || b.x > CANVAS_W + 20) {
          gs.bullets.splice(i, 1)
        }
      }

      // ── Update enemy bullets ──
      for (let i = gs.enemyBullets.length - 1; i >= 0; i--) {
        const eb = gs.enemyBullets[i]
        eb.x += eb.vx
        eb.y += eb.vy
        if (
          eb.y > CANVAS_H + 10 ||
          eb.y < -10 ||
          eb.x < -10 ||
          eb.x > CANVAS_W + 10
        ) {
          gs.enemyBullets.splice(i, 1)
        }
      }

      // ── Spawn enemies (difficulty-scaled) ──
      gs.enemySpawnTimer++
      // Smoother curve: ramps up over a wider score range; wave bonus for post-boss intensity
      const scoreFactor = Math.max(0.42, 1 - gs.player.score / 6000)
      const waveFactor = Math.max(0.6, 1 - gs.bossesDefeated * 0.12)
      const spawnInterval = Math.floor(diff.spawnIntervalBase * scoreFactor * waveFactor)

      if (gs.enemySpawnTimer >= spawnInterval && !gs.boss && gs.bossIncoming === null) {
        gs.enemySpawnTimer = 0
        const roll = Math.random()
        let newEnemy
        if (roll < 0.5) {
          newEnemy = spawnEnemy('scout')
        } else if (roll < 0.8) {
          newEnemy = spawnEnemy('strafer')
        } else {
          newEnemy = spawnEnemy('bomber')
        }
        gs.enemies.push(newEnemy)

        // Danger sense (Anxiety)
        if (stats.perk === 'danger-sense') {
          gs.dangerWarnings.push({
            x: newEnemy.x + newEnemy.w / 2,
            life: 40,
            maxLife: 40,
          })
        }
      }

      // Boss spawn — progressive bosses with a WARNING screen first (loops infinitely)
      const cycleSize = BOSS_DEFINITIONS.length
      const currentBossIdx = gs.bossesDefeated % cycleSize
      const currentCycle = Math.floor(gs.bossesDefeated / cycleSize)
      // Every cycle is 5000 score threshold increment
      const targetScore = currentCycle * 5000 + BOSS_DEFINITIONS[currentBossIdx].scoreThreshold

      if (!gs.boss && p.score >= targetScore) {
        if (gs.bossIncoming === null) {
          // Trigger the warning — sweep the field and start countdown
          gs.bossIncoming = currentBossIdx
          gs.bossIncomingTimer = 160   // ~2.7 s at 60 fps
          gs.enemies = []
          // 🔊 Boss warning siren + intensify music
          if (audioRef.current) {
            audioRef.current.startSiren()
            audioRef.current.setMusicIntensity('intense')
          }
          gs.enemyBullets = []
        } else {
          gs.bossIncomingTimer--
          if (gs.bossIncomingTimer <= 0) {
            spawnBoss(gs.bossesDefeated)
            gs.bossIncoming = null
            // 🔊 Stop siren when boss actually spawns
            if (audioRef.current) audioRef.current.stopSiren()
          }
        }
      }

      // ── Update enemies ──
      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        const e = gs.enemies[i]
        e.y += e.speed
        e.x += e.vx

        if (e.flashTimer > 0) e.flashTimer--

        // Bounce strafers off walls
        if (e.type === 'strafer') {
          if (e.x <= 0 || e.x + e.w >= CANVAS_W) e.vx *= -1
        }

        // Firing — EverWing style
        // Strafer: fires a fixed 3-bullet downward spread (pattern, not aimed)
        // Bomber: the ONE tracker — slow aimed shot the player can react to
        if (e.fireRate > 0) {
          e.fireCooldown--
          if (e.fireCooldown <= 0) {
            e.fireCooldown = e.fireRate
            const bulletSpd = diff.label === 'Easy' ? 2.5 : diff.label === 'Hard' ? 4.0 : 3.0
            // Cap enemy bullets to avoid lag — oldest bullets removed if needed
            if (gs.enemyBullets.length > 65) gs.enemyBullets.splice(0, gs.enemyBullets.length - 65)
            if (e.type === 'strafer') {
              // Pattern fire: 3 bullets in a fixed downward fan (not aimed)
              for (let lane = -1; lane <= 1; lane++) {
                gs.enemyBullets.push({
                  x: e.x + e.w / 2 + lane * 10,
                  y: e.y + e.h,
                  vx: lane * 0.6,
                  vy: bulletSpd,
                  w: 10,
                  h: 10,
                  color: '#FF8833',
                  shape: 'diamond',
                })
              }
            } else if (e.type === 'bomber') {
              // Bomber: the tracker — telegraphed aimed shot (fires slowly)
              const angle = Math.atan2(
                gs.player.y + JET_H / 2 - (e.y + e.h / 2),
                gs.player.x + JET_W / 2 - (e.x + e.w / 2)
              )
              gs.enemyBullets.push({
                x: e.x + e.w / 2,
                y: e.y + e.h / 2,
                vx: Math.cos(angle) * bulletSpd * 0.85,
                vy: Math.sin(angle) * bulletSpd * 0.85,
                w: 14,
                h: 14,
                color: '#FF44FF',
                shape: 'orb',
              })
            }
          }
        }

        // Off-screen removal
        if (e.y > CANVAS_H + 50) {
          gs.enemies.splice(i, 1)
          continue
        }

        // Collision with player
        const playerHitbox = {
          x: p.x + (JET_W * (1 - p.hitboxShrink)) / 2,
          y: p.y + (JET_H * (1 - p.hitboxShrink)) / 2,
          w: JET_W * p.hitboxShrink,
          h: JET_H * p.hitboxShrink,
        }
        if (aabbCollision(playerHitbox, e)) {
          if (stats.perk === 'toxic-contact') {
            e.hp -= 3
            e.flashTimer = 4
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#66FF66', 6)
          }
          damagePlayer()
        }
      }

      // ── Update boss ──
      if (gs.boss) {
        const b = gs.boss
        if (b.flashTimer > 0) b.flashTimer--

        if (b.entering) {
          b.y = lerp(b.y, b.targetY, 0.03)
          if (Math.abs(b.y - b.targetY) < 1) {
            b.entering = false
          }
        } else {
          b.x += b.vx
          if (b.x <= 10 || b.x + b.w >= CANVAS_W - 10) b.vx *= -1

          b.fireCooldown--
          if (b.fireCooldown <= 0) {
            b.fireCooldown = b.fireRate

            const bcx = b.x + b.w / 2
            const bcy = b.y + b.h
            const isPhase2 = b.hp < b.maxHp * 0.5
            // Scale boss bullet speed by difficulty speed multiplier (exciting, arcade-style speed)
            const bSpd = (diff.enemySpeedMult || 1.0) * 1.5

            if (b.type === 'burnout') {
              if (isPhase2) {
                // Phase 2: 8-way spiral (downward-biased double spiral)
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                  const angle = a + gs.frame * 0.05
                  gs.enemyBullets.push({
                    x: bcx, y: bcy,
                    vx: Math.cos(angle) * 1.5 * bSpd,
                    vy: Math.abs(Math.sin(angle)) * 1.5 * bSpd + 1.2,
                    w: 12, h: 12, color: '#FF2266', shape: 'star',
                  })
                }
              } else {
                // Phase 1: 3-bullet spread with generous jitter (readable, dodgeable)
                const baseAngle = Math.atan2(p.y + JET_H / 2 - bcy, p.x + JET_W / 2 - bcx)
                const spread = diff.label === 'Easy' ? 0.5 : diff.label === 'Hard' ? 0.18 : 0.32
                for (let d = -0.2; d <= 0.2; d += 0.2) {
                  const jitter = (Math.random() - 0.5) * 2 * spread
                  gs.enemyBullets.push({
                    x: bcx, y: bcy,
                    vx: Math.cos(baseAngle + d + jitter) * 2.0 * bSpd,
                    vy: Math.max(1.8, Math.sin(baseAngle + d + jitter) * 2.0 * bSpd),
                    w: 11, h: 11, color: '#FF4488', shape: 'triangle',
                  })
                }
              }
            } else if (b.type === 'perfectionism') {
              if (isPhase2) {
                // Phase 2: 8-way diamonds (downward-cascading pattern)
                const dirs = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (3 * Math.PI) / 2, (7 * Math.PI) / 4]
                for (const a of dirs) {
                  gs.enemyBullets.push({
                    x: bcx, y: bcy,
                    vx: Math.cos(a) * 2.2 * bSpd,
                    vy: Math.abs(Math.sin(a)) * 2.2 * bSpd + 1.2,
                    w: 12, h: 12, color: '#00FFFF', shape: 'diamond',
                  })
                }
              } else {
                // Phase 1: 4-way cross (downward) + aimed shot with spread
                const dirs = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
                for (const a of dirs) {
                  gs.enemyBullets.push({
                    x: bcx, y: bcy,
                    vx: Math.cos(a) * 2.0 * bSpd,
                    vy: Math.abs(Math.sin(a)) * 2.0 * bSpd + 1.2,
                    w: 13, h: 13, color: '#44EEFF', shape: 'diamond',
                  })
                }
                // Aimed shot — slower, more telegraphed
                const spread = diff.label === 'Easy' ? 0.45 : diff.label === 'Hard' ? 0.12 : 0.28
                const angle = Math.atan2(p.y + JET_H / 2 - bcy, p.x + JET_W / 2 - bcx)
                const jitter = (Math.random() - 0.5) * 2 * spread
                gs.enemyBullets.push({
                  x: bcx, y: bcy,
                  vx: Math.cos(angle + jitter) * 2.8 * bSpd,
                  vy: Math.max(2.0, Math.sin(angle + jitter) * 2.8 * bSpd),
                  w: 10, h: 10, color: '#FFFFFF', shape: 'diamond',
                })
              }
            } else if (b.type === 'despair') {
              if (isPhase2) {
                // Phase 2: 8-way vortex (downward-sweeping spiral)
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                  const spiralOffset = gs.frame * 0.03
                  const angle = a + spiralOffset
                  gs.enemyBullets.push({
                    x: bcx, y: bcy,
                    vx: Math.cos(angle) * 1.4 * bSpd,
                    vy: Math.abs(Math.sin(angle)) * 1.4 * bSpd + 1.5,
                    w: 14, h: 14, color: '#6688FF', shape: 'orb',
                  })
                }
              } else {
                // Phase 1: aimed orb + 3-bullet sweeping arc
                const spread = diff.label === 'Easy' ? 0.52 : diff.label === 'Hard' ? 0.15 : 0.32
                const angle = Math.atan2(p.y + JET_H / 2 - bcy, p.x + JET_W / 2 - bcx)
                const jitter = (Math.random() - 0.5) * 2 * spread
                gs.enemyBullets.push({
                  x: bcx, y: bcy,
                  vx: Math.cos(angle + jitter) * 1.6 * bSpd,
                  vy: Math.max(2.0, Math.sin(angle + jitter) * 1.6 * bSpd),
                  w: 16, h: 16, color: '#4488FF', shape: 'orb',
                })
                // Reduced arc: 3 bullets instead of 5
                for (let d = -0.3; d <= 0.3; d += 0.3) {
                  gs.enemyBullets.push({
                    x: bcx, y: bcy,
                    vx: Math.cos(angle + d) * 1.2 * bSpd,
                    vy: Math.max(1.5, Math.sin(angle + d) * 1.2 * bSpd + 0.8),
                    w: 12, h: 12, color: '#2255CC', shape: 'orb',
                  })
                }
              }
            }
          }

          // Collision with player
          const playerHitbox = {
            x: p.x + (JET_W * (1 - p.hitboxShrink)) / 2,
            y: p.y + (JET_H * (1 - p.hitboxShrink)) / 2,
            w: JET_W * p.hitboxShrink,
            h: JET_H * p.hitboxShrink,
          }
          if (aabbCollision(playerHitbox, b)) {
            damagePlayer()
          }
        }
      }

      // ── Bullet → Enemy collisions ──
      for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
        const b = gs.bullets[bi]
        let bulletConsumed = false

        // Check boss
        if (gs.boss && !gs.boss.entering) {
          if (aabbCollision(b, gs.boss)) {
            gs.boss.hp -= b.damage
            gs.boss.flashTimer = 3
            spawnParticles(b.x, b.y, stats.bulletColor, 3)

            if (gs.boss.hp <= 0) {
              spawnExplosion(
                gs.boss.x + gs.boss.w / 2,
                gs.boss.y + gs.boss.h / 2,
                3
              )
              p.score += gs.boss.scoreValue
              spawnScoreFloater(
                gs.boss.x + gs.boss.w / 2,
                gs.boss.y,
                gs.boss.scoreValue
              )
              applyScreenShake(10, 25)
              gs.bossesDefeated++
              gs.boss = null
              // 🔊 Boss explosion + return music to normal
              if (audioRef.current) {
                audioRef.current.playBossExplosion()
                audioRef.current.setMusicIntensity('normal')
              }
            }
            if (!b.piercing) {
              gs.bullets.splice(bi, 1)
              bulletConsumed = true
            }
          }
        }

        if (bulletConsumed) continue

        for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
          const e = gs.enemies[ei]
          if (aabbCollision(b, e)) {
            e.hp -= b.damage
            e.flashTimer = 3
            spawnParticles(b.x, b.y, stats.bulletColor, 3)
            // 🔊 Hit sound
            if (audioRef.current) audioRef.current.playHit()

            if (b.slow) e.speed *= 0.6

            // AOE from Anger fireballs
            if (b.aoe) {
              for (let ej = gs.enemies.length - 1; ej >= 0; ej--) {
                if (ej === ei) continue
                const other = gs.enemies[ej]
                if (
                  dist(
                    { x: b.x, y: b.y },
                    { x: other.x + other.w / 2, y: other.y + other.h / 2 }
                  ) < b.aoeRadius
                ) {
                  other.hp -= b.damage * 0.5
                  other.flashTimer = 3
                  spawnParticles(
                    other.x + other.w / 2,
                    other.y + other.h / 2,
                    '#FF8800',
                    3
                  )
                }
              }
            }

            if (e.hp <= 0) {
              spawnExplosion(e.x + e.w / 2, e.y + e.h / 2)
              // 🔊 Explosion sound
              if (audioRef.current) audioRef.current.playExplosion()
              gs.combo++
              gs.comboTimer = 90
              const comboMult = Math.min(gs.combo, 5)
              const points = e.scoreValue * comboMult
              p.score += points
              spawnScoreFloater(e.x + e.w / 2, e.y, points)

              if (Math.random() < POWER_UP_DROP_CHANCE) {
                spawnPowerUp(e.x + e.w / 2 - 10, e.y + e.h / 2)
              }
              gs.enemies.splice(ei, 1)
            }

            if (!b.piercing) {
              gs.bullets.splice(bi, 1)
              bulletConsumed = true
              break
            }
          }
        }
      }

      // ── Enemy bullet → Player collisions ──
      const playerHitbox = {
        x: p.x + (JET_W * (1 - p.hitboxShrink)) / 2,
        y: p.y + (JET_H * (1 - p.hitboxShrink)) / 2,
        w: JET_W * p.hitboxShrink,
        h: JET_H * p.hitboxShrink,
      }
      for (let i = gs.enemyBullets.length - 1; i >= 0; i--) {
        if (aabbCollision(gs.enemyBullets[i], playerHitbox)) {
          damagePlayer()
          gs.enemyBullets.splice(i, 1)
        }
      }

      // ── Power-ups ──
      for (let i = gs.powerUps.length - 1; i >= 0; i--) {
        const pu = gs.powerUps[i]
        pu.y += pu.vy
        pu.x += pu.vx || 0   // horizontal drift while falling

        // Magnet effect
        const magnetDist = 60 * stats.magnetRadius
        const dToPl = dist(
          { x: pu.x + pu.w / 2, y: pu.y + pu.h / 2 },
          { x: p.x + JET_W / 2, y: p.y + JET_H / 2 }
        )
        if (dToPl < magnetDist) {
          const tx = p.x + JET_W / 2 - (pu.x + pu.w / 2)
          const ty = p.y + JET_H / 2 - (pu.y + pu.h / 2)
          const len = Math.hypot(tx, ty) || 1
          pu.x += (tx / len) * 3
          pu.y += (ty / len) * 3
        }

        if (aabbCollision(pu, { x: p.x, y: p.y, w: JET_W, h: JET_H })) {
          switch (pu.type) {
            case 'shield':
              p.shieldActive = true
              p.shieldTimer = Math.max(p.shieldTimer || 0, 300)
              break
            case 'double-shot':
              p.doubleShot = true
              p.doubleShotTimer = Math.max(p.doubleShotTimer || 0, 600)
              break
            case 'heal':
              p.lives = Math.min(p.lives + 1, diff.startingHearts + 1)
              break
          }
          spawnParticles(pu.x, pu.y, pu.color, 10, 1.5)
          // 🔊 Power-up pickup sound
          if (audioRef.current) audioRef.current.playPowerUp()
          gs.powerUps.splice(i, 1)
          continue
        }

        if (pu.y > CANVAS_H + 20) {
          gs.powerUps.splice(i, 1)
        }
      }

      // ── Update particles + explosions + floaters + warnings ──
      updateParticles()

      // ── Screen shake ──
      if (gs.shakeDuration > 0) {
        gs.shakeDuration--
        gs.shakeX = rand(-3, 3) * (gs.shakeDuration / 15)
        gs.shakeY = rand(-3, 3) * (gs.shakeDuration / 15)
      } else {
        gs.shakeX = 0
        gs.shakeY = 0
      }

      // ── Character aura trail ──
      if (gs.frame % 3 === 0) {
        const auraColors = [stats.color, stats.bulletColor, '#FFFFFF', stats.color + 'AA']
        gs.particles.push({
          x: p.x + JET_W / 2 + rand(-6, 6),
          y: p.y + JET_H + rand(0, 4),
          vx: rand(-0.5, 0.5),
          vy: rand(1, 2.5),
          life: rand(8, 16),
          maxLife: 16,
          color: auraColors[randInt(0, auraColors.length - 1)],
          size: rand(1.5, 4),
        })
      }
    }

    function updateParticles() {
      for (let i = gs.particles.length - 1; i >= 0; i--) {
        const pt = gs.particles[i]
        pt.x += pt.vx
        pt.y += pt.vy
        pt.life--
        if (pt.life <= 0) gs.particles.splice(i, 1)
      }
      for (let i = gs.explosions.length - 1; i >= 0; i--) {
        const ex = gs.explosions[i]
        ex.life--
        ex.radius = ex.maxRadius * (1 - ex.life / ex.maxLife)
        if (ex.life <= 0) gs.explosions.splice(i, 1)
      }
      for (let i = gs.scoreFloaters.length - 1; i >= 0; i--) {
        const sf = gs.scoreFloaters[i]
        sf.y -= 1.2
        sf.life--
        if (sf.life <= 0) gs.scoreFloaters.splice(i, 1)
      }
      for (let i = gs.dangerWarnings.length - 1; i >= 0; i--) {
        gs.dangerWarnings[i].life--
        if (gs.dangerWarnings[i].life <= 0) gs.dangerWarnings.splice(i, 1)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════════════
    function drawEnemy(e) {
      ctx.save()
      if (e.flashTimer > 0) {
        ctx.globalAlpha = 0.8
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(e.x, e.y, e.w, e.h)
        ctx.restore()
        return
      }

      const cx = e.x + e.w / 2
      const cy = e.y + e.h / 2

      // Try sprite image first
      const eImg = enemyImgs[e.type]
      if (eImg && eImg.complete && eImg.naturalWidth) {
        ctx.drawImage(eImg, e.x - 4, e.y - 4, e.w + 8, e.h + 8)
      } else if (e.type === 'scout') {
        // ── "Intrusive Thought" — spiky shadow blob with red eyes ──
        ctx.fillStyle = e.color
        ctx.beginPath()
        const spikes = 7
        for (let i = 0; i <= spikes; i++) {
          const a = (Math.PI * 2 * i) / spikes - Math.PI / 2
          const r = i % 2 === 0 ? e.w * 0.5 : e.w * 0.3
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        }
        ctx.closePath()
        ctx.fill()
        // Glowing red eyes
        ctx.fillStyle = '#FF3333'
        ctx.beginPath()
        ctx.arc(cx - 5, cy - 1, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx + 5, cy - 1, 2.5, 0, Math.PI * 2)
        ctx.fill()
      } else if (e.type === 'strafer') {
        // ── "Overwhelm" — jittery multi-armed creature ──
        ctx.fillStyle = e.color
        ctx.beginPath()
        const arms = 8
        for (let i = 0; i <= arms; i++) {
          const a = (Math.PI * 2 * i) / arms
          const jitter = Math.sin(gs.frame * 0.3 + i) * 3
          const r = i % 2 === 0 ? e.w * 0.55 + jitter : e.w * 0.28
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        }
        ctx.closePath()
        ctx.fill()
        // Multiple frantic yellow eyes
        ctx.fillStyle = '#FFEE44'
        for (let i = 0; i < 3; i++) {
          ctx.beginPath()
          ctx.arc(cx - 6 + i * 6, cy - 3, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (e.type === 'bomber') {
        // ── "Panic Attack" — pulsating spiky sphere ──
        const pulse = 1 + Math.sin(gs.frame * 0.15) * 0.08
        ctx.fillStyle = e.color
        ctx.beginPath()
        const pts = 10
        for (let i = 0; i <= pts; i++) {
          const a = (Math.PI * 2 * i) / pts
          const r = i % 2 === 0 ? e.w * 0.5 * pulse : e.w * 0.35 * pulse
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
        }
        ctx.closePath()
        ctx.fill()
        // Glowing unstable core
        ctx.fillStyle = '#FF0033'
        ctx.beginPath()
        ctx.arc(cx, cy, e.w * 0.15 * pulse, 0, Math.PI * 2)
        ctx.fill()
        // Electric arcs
        ctx.strokeStyle = '#FF666688'
        ctx.lineWidth = 1
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 * i) / 3 + gs.frame * 0.05
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(a) * e.w * 0.4, cy + Math.sin(a) * e.h * 0.4)
          ctx.stroke()
        }
      }

      // HP bar for tough enemies (bomber+)
      if (e.maxHp > 2) {
        const hpPct = e.hp / e.maxHp
        ctx.fillStyle = '#333'
        ctx.fillRect(e.x, e.y - 6, e.w, 3)
        ctx.fillStyle =
          hpPct > 0.5 ? '#44FF44' : hpPct > 0.25 ? '#FFAA00' : '#FF4444'
        ctx.fillRect(e.x, e.y - 6, e.w * hpPct, 3)
      }

      ctx.restore()
    }

    function drawBoss(b) {
      if (!b) return
      ctx.save()

      if (b.flashTimer > 0) {
        ctx.globalAlpha = 0.8
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(b.x, b.y, b.w, b.h)
        ctx.restore()
        return
      }

      const cx = b.x + b.w / 2
      const cy = b.y + b.h / 2

      // Try sprite image first
      const bImg = bossImgs[b.type]
      if (bImg && bImg.complete && bImg.naturalWidth) {
        ctx.drawImage(bImg, b.x - 10, b.y - 10, b.w + 20, b.h + 20)
      } else if (b.type === 'burnout') {
        // ── Canvas-drawn "BURNOUT" boss ──
        const pulse = 1 + Math.sin(gs.frame * 0.06) * 0.05
        ctx.fillStyle = '#2A1A2E'
        ctx.beginPath()
        ctx.ellipse(cx, cy + 5, b.w * 0.5 * pulse, b.h * 0.4 * pulse, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx - b.w * 0.2, cy - b.h * 0.2, b.w * 0.22, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx + b.w * 0.2, cy - b.h * 0.15, b.w * 0.18, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx, cy - b.h * 0.28, b.w * 0.2, 0, Math.PI * 2)
        ctx.fill()
        // Glowing energy cores
        const coreGlow = Math.sin(gs.frame * 0.1) * 0.3 + 0.7
        ctx.fillStyle = `rgba(255, 34, 102, ${coreGlow})`
        ctx.beginPath()
        ctx.arc(cx - 15, cy, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(68, 100, 255, ${coreGlow})`
        ctx.beginPath()
        ctx.arc(cx + 15, cy, 8, 0, Math.PI * 2)
        ctx.fill()
        // Heavy drooping eyes
        ctx.fillStyle = '#FF8888'
        ctx.beginPath()
        ctx.ellipse(cx - 18, cy - 8, 10, 5, 0.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#330011'
        ctx.beginPath()
        ctx.ellipse(cx - 18, cy - 6, 4, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#FF8888'
        ctx.beginPath()
        ctx.ellipse(cx + 18, cy - 8, 10, 5, -0.1, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#330011'
        ctx.beginPath()
        ctx.ellipse(cx + 18, cy - 6, 4, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        // Smoky tendrils
        ctx.strokeStyle = '#2A1A2E88'
        ctx.lineWidth = 3
        for (let i = 0; i < 4; i++) {
          const tx = cx - 30 + i * 20
          ctx.beginPath()
          ctx.moveTo(tx, cy + b.h * 0.3)
          ctx.quadraticCurveTo(
            tx + Math.sin(gs.frame * 0.04 + i) * 10, cy + b.h * 0.5,
            tx + Math.sin(gs.frame * 0.03 + i * 2) * 15, cy + b.h * 0.7
          )
          ctx.stroke()
        }
      } else if (b.type === 'perfectionism') {
        // ── Canvas-drawn "PERFECTIONISM" boss ──
        const pulse = 1 + Math.sin(gs.frame * 0.08) * 0.03
        // Crystalline diamond body
        ctx.fillStyle = '#0A1A2A'
        ctx.beginPath()
        ctx.moveTo(cx, cy - b.h * 0.45 * pulse)
        ctx.lineTo(cx + b.w * 0.45 * pulse, cy)
        ctx.lineTo(cx, cy + b.h * 0.45 * pulse)
        ctx.lineTo(cx - b.w * 0.45 * pulse, cy)
        ctx.closePath()
        ctx.fill()
        // Inner diamond
        ctx.fillStyle = '#112233'
        ctx.beginPath()
        ctx.moveTo(cx, cy - b.h * 0.25)
        ctx.lineTo(cx + b.w * 0.25, cy)
        ctx.lineTo(cx, cy + b.h * 0.25)
        ctx.lineTo(cx - b.w * 0.25, cy)
        ctx.closePath()
        ctx.fill()
        // Glowing cyan energy lines
        ctx.strokeStyle = '#00DDFF'
        ctx.lineWidth = 2
        const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]
        for (const a of angles) {
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(a) * b.w * 0.4, cy + Math.sin(a) * b.h * 0.4)
          ctx.stroke()
        }
        // Cold calculating eyes
        ctx.fillStyle = '#FFFFFF'
        ctx.beginPath()
        ctx.ellipse(cx - 12, cy - 4, 6, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(cx + 12, cy - 4, 6, 3, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#00CCFF'
        ctx.beginPath()
        ctx.arc(cx - 12, cy - 4, 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx + 12, cy - 4, 2, 0, Math.PI * 2)
        ctx.fill()
        // Orbiting crystal shards
        ctx.fillStyle = '#44EEFF88'
        for (let i = 0; i < 4; i++) {
          const orbitA = (Math.PI * 2 * i) / 4 + gs.frame * 0.04
          const ox = cx + Math.cos(orbitA) * b.w * 0.55
          const oy = cy + Math.sin(orbitA) * b.h * 0.55
          ctx.save()
          ctx.translate(ox, oy)
          ctx.rotate(orbitA)
          ctx.fillRect(-3, -5, 6, 10)
          ctx.restore()
        }
      } else if (b.type === 'despair') {
        // ── Canvas-drawn "DESPAIR" boss ──
        const pulse = 1 + Math.sin(gs.frame * 0.04) * 0.06
        // Swirling void body
        ctx.fillStyle = '#0A0A22'
        ctx.beginPath()
        ctx.ellipse(cx, cy, b.w * 0.45 * pulse, b.h * 0.45 * pulse, 0, 0, Math.PI * 2)
        ctx.fill()
        // Inner vortex rings
        ctx.strokeStyle = '#223366'
        ctx.lineWidth = 2
        for (let r = 0.15; r <= 0.35; r += 0.1) {
          ctx.beginPath()
          ctx.ellipse(cx, cy, b.w * r * pulse, b.h * r * pulse, gs.frame * 0.02, 0, Math.PI * 2)
          ctx.stroke()
        }
        // Sorrowful glowing eyes
        const tearGlow = Math.sin(gs.frame * 0.08) * 0.3 + 0.7
        ctx.fillStyle = `rgba(68, 136, 255, ${tearGlow})`
        ctx.beginPath()
        ctx.ellipse(cx - 18, cy - 8, 8, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(cx + 18, cy - 8, 8, 10, 0, 0, Math.PI * 2)
        ctx.fill()
        // Dark pupils
        ctx.fillStyle = '#000033'
        ctx.beginPath()
        ctx.arc(cx - 18, cy - 6, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx + 18, cy - 6, 3, 0, Math.PI * 2)
        ctx.fill()
        // Tear streams
        ctx.strokeStyle = `rgba(68, 136, 255, ${tearGlow * 0.6})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx - 18, cy + 2)
        ctx.quadraticCurveTo(cx - 20, cy + b.h * 0.3, cx - 16, cy + b.h * 0.5)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx + 18, cy + 2)
        ctx.quadraticCurveTo(cx + 20, cy + b.h * 0.3, cx + 16, cy + b.h * 0.5)
        ctx.stroke()
        // Shadow tendrils
        ctx.strokeStyle = '#1A1A4488'
        ctx.lineWidth = 3
        for (let i = 0; i < 5; i++) {
          const ta = (Math.PI * 2 * i) / 5 + gs.frame * 0.02
          ctx.beginPath()
          ctx.moveTo(cx + Math.cos(ta) * b.w * 0.3, cy + Math.sin(ta) * b.h * 0.3)
          ctx.quadraticCurveTo(
            cx + Math.cos(ta) * b.w * 0.6 + Math.sin(gs.frame * 0.03 + i) * 8,
            cy + Math.sin(ta) * b.h * 0.6,
            cx + Math.cos(ta) * b.w * 0.75,
            cy + Math.sin(ta) * b.h * 0.75
          )
          ctx.stroke()
        }
      }

      // ── HP bar ──
      const barW = b.w + 20
      const barX = b.x - 10
      const barY = b.y - 14
      ctx.fillStyle = '#222'
      ctx.fillRect(barX, barY, barW, 8)
      const hpPct = b.hp / b.maxHp
      // Solid color based on health — no gradient (cheaper than createLinearGradient)
      ctx.fillStyle = hpPct > 0.5 ? b.color : hpPct > 0.25 ? '#FFAA00' : '#FF3333'
      ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, 6)
      ctx.strokeStyle = b.color + '88'
      ctx.strokeRect(barX, barY, barW, 8)

      // Boss label
      ctx.fillStyle = b.color
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`⚠ ${b.name} ⚠`, cx, barY - 4)

      ctx.restore()
    }

    function render() {
      ctx.save()
      ctx.translate(gs.shakeX, gs.shakeY)

      // ── Background ──
      if (bgImg.complete && bgImg.naturalWidth) {
        const fullLoop = CANVAS_H * 2
        const yOff = gs.bgScrollY % fullLoop

        ctx.drawImage(bgImg, 0, yOff, CANVAS_W, CANVAS_H)
        ctx.drawImage(bgImg, 0, yOff - fullLoop, CANVAS_W, CANVAS_H)

        ctx.save()
        ctx.scale(1, -1)
        ctx.drawImage(bgImg, 0, -yOff, CANVAS_W, CANVAS_H)
        ctx.drawImage(bgImg, 0, -yOff + fullLoop, CANVAS_W, CANVAS_H)
        ctx.restore()
      } else {
        ctx.fillStyle = '#0a0a1a'
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      }

      // ── Parallax stars (fillRect is cheaper than arc × 60) ──
      for (const star of gs.stars) {
        const alpha = star.brightness * (0.6 + Math.sin(gs.frame * 0.05 + star.x) * 0.4)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`
        const s = star.size
        ctx.fillRect(star.x - s, star.y - s, s * 2, s * 2)
      }

      // ── Danger warnings (Anxiety perk) ──
      for (const dw of gs.dangerWarnings) {
        const alpha = dw.life / dw.maxLife
        ctx.save()
        ctx.globalAlpha = alpha * (Math.sin(gs.frame * 0.4) * 0.5 + 0.5)
        ctx.fillStyle = '#FF4400'
        ctx.font = 'bold 16px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('⚠', dw.x, 18)
        ctx.restore()
      }

      // ── Power-ups ──
      for (const pu of gs.powerUps) {
        ctx.save()
        ctx.fillStyle = pu.color
        ctx.beginPath()
        ctx.arc(pu.x + pu.w / 2, pu.y + pu.h / 2, pu.w / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(pu.symbol, pu.x + pu.w / 2, pu.y + pu.h / 2)
        ctx.restore()
      }

      // ── Enemies ──
      for (const e of gs.enemies) {
        drawEnemy(e)
      }

      // ── Boss ──
      if (gs.boss) drawBoss(gs.boss)

      // ── Player bullets (batched) ──
      ctx.save()
      for (const b of gs.bullets) {
        ctx.fillStyle = b.color
        if (b.w > 6 || b.h > 14) {
          ctx.beginPath()
          ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(b.x, b.y, b.w, b.h)
        }
      }
      ctx.restore()

      // ── Enemy bullets (batched — one save/restore) ──
      ctx.save()
      for (const eb of gs.enemyBullets) {
        const bx = eb.x + eb.w / 2
        const by = eb.y + eb.h / 2
        const br = eb.w / 2
        ctx.fillStyle = eb.color

        if (eb.shape === 'diamond') {
          ctx.beginPath()
          ctx.moveTo(bx, by - br * 1.2)
          ctx.lineTo(bx + br * 0.85, by)
          ctx.lineTo(bx, by + br * 1.2)
          ctx.lineTo(bx - br * 0.85, by)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.fillStyle = '#FFFFFF55'
          ctx.beginPath()
          ctx.moveTo(bx, by - br * 0.5)
          ctx.lineTo(bx + br * 0.3, by)
          ctx.lineTo(bx, by + br * 0.5)
          ctx.lineTo(bx - br * 0.3, by)
          ctx.closePath()
          ctx.fill()

        } else if (eb.shape === 'triangle') {
          const dir = eb.vy > 0 ? 1 : -1
          ctx.beginPath()
          ctx.moveTo(bx, by + br * 1.3 * dir)
          ctx.lineTo(bx - br * 0.9, by - br * 0.8 * dir)
          ctx.lineTo(bx + br * 0.9, by - br * 0.8 * dir)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.fillStyle = '#FFFFFF55'
          ctx.beginPath()
          ctx.moveTo(bx, by + br * 0.5 * dir)
          ctx.lineTo(bx - br * 0.3, by - br * 0.3 * dir)
          ctx.lineTo(bx + br * 0.3, by - br * 0.3 * dir)
          ctx.closePath()
          ctx.fill()

        } else if (eb.shape === 'star') {
          ctx.beginPath()
          for (let i = 0; i < 8; i++) {
            const a = (Math.PI * 2 * i) / 8 - Math.PI / 4
            const r = i % 2 === 0 ? br * 1.4 : br * 0.55
            i === 0 ? ctx.moveTo(bx + Math.cos(a) * r, by + Math.sin(a) * r)
              : ctx.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r)
          }
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.fillStyle = '#FFFFFF88'
          ctx.beginPath()
          ctx.arc(bx, by, br * 0.3, 0, Math.PI * 2)
          ctx.fill()

        } else {
          // orb — flat fill + white ring
          ctx.beginPath()
          ctx.arc(bx, by, br, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#FFFFFF'
          ctx.lineWidth = 1.5
          ctx.stroke()
          ctx.fillStyle = '#FFFFFFBB'
          ctx.beginPath()
          ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.28, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.restore()

      // ── Particles (fillRect square retro particles is up to 50x faster than arc path fills) ──
      ctx.save()
      for (const pt of gs.particles) {
        const alpha = pt.life / pt.maxLife
        const size = Math.max(0.5, pt.size * alpha)
        ctx.fillStyle = fillStyleForColor(pt.color, alpha)
        ctx.fillRect(pt.x - size, pt.y - size, size * 2, size * 2)
      }
      ctx.restore()

      // ── Explosions (batched) ──
      ctx.save()
      for (const ex of gs.explosions) {
        const alpha = (ex.life / ex.maxLife) * 0.7
        // Outer blast
        ctx.fillStyle = `rgba(255, 136, 0, ${alpha.toFixed(2)})`
        ctx.beginPath()
        ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2)
        ctx.fill()
        // Inner white-hot core
        ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.5).toFixed(2)})`
        ctx.beginPath()
        ctx.arc(ex.x, ex.y, ex.radius * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      // ── Player Character ──
      if (!gs.gameOver) {
        const p = gs.player
        const showPlayer =
          p.invincibleTimer <= 0 ||
          Math.floor(p.invincibleTimer / 4) % 2 === 0

        if (showPlayer) {
          ctx.save()

          // Shield glow
          if (p.shieldActive) {
            ctx.strokeStyle = '#44DDFF88'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.ellipse(
              p.x + JET_W / 2,
              p.y + JET_H / 2,
              JET_W * 0.7,
              JET_H * 0.6,
              0,
              0,
              Math.PI * 2
            )
            ctx.stroke()
          }

          // Rage glow
          if (p.rageTimer > 0) {
            ctx.fillStyle = '#FF440033'
            ctx.beginPath()
            ctx.ellipse(
              p.x + JET_W / 2,
              p.y + JET_H / 2,
              JET_W * 0.8,
              JET_H * 0.7,
              0,
              0,
              Math.PI * 2
            )
            ctx.fill()
          }

          // Draw character sprite (bird's-eye overhead view)
          if (characterImg.complete && characterImg.naturalWidth) {
            ctx.drawImage(characterImg, p.x - 8, p.y - 4, JET_W + 16, JET_H + 8)
          } else {
            // ── Canvas placeholder: overhead chibi with wings ──
            const cx = p.x + JET_W / 2
            const cy = p.y + JET_H / 2

            // Translucent wings spread horizontally
            ctx.fillStyle = stats.color + '55'
            // Left wing
            ctx.beginPath()
            ctx.ellipse(cx - JET_W * 0.5, cy + 2, JET_W * 0.35, JET_H * 0.16, -0.2, 0, Math.PI * 2)
            ctx.fill()
            // Right wing
            ctx.beginPath()
            ctx.ellipse(cx + JET_W * 0.5, cy + 2, JET_W * 0.35, JET_H * 0.16, 0.2, 0, Math.PI * 2)
            ctx.fill()

            // Body (oval from above)
            ctx.fillStyle = stats.color
            ctx.beginPath()
            ctx.ellipse(cx, cy + 4, JET_W * 0.2, JET_H * 0.28, 0, 0, Math.PI * 2)
            ctx.fill()

            // Head (top of head, seen from above)
            ctx.beginPath()
            ctx.arc(cx, cy - JET_H * 0.18, JET_W * 0.19, 0, Math.PI * 2)
            ctx.fill()

            // Hair highlight
            ctx.fillStyle = '#FFFFFF33'
            ctx.beginPath()
            ctx.arc(cx - 2, cy - JET_H * 0.22, JET_W * 0.07, 0, Math.PI * 2)
            ctx.fill()

            // Weapon glow aimed upward (front)
            ctx.fillStyle = stats.bulletColor
            ctx.beginPath()
            ctx.arc(cx, p.y + 4, 3, 0, Math.PI * 2)
            ctx.fill()
          }

          ctx.restore()
        }

        // ── Drone (Envy) ──
        if (gs.drone) {
          ctx.save()
          ctx.fillStyle = '#44FFDD'
          ctx.beginPath()
          ctx.arc(gs.drone.x + 6, gs.drone.y + 6, 6, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#FFFFFF88'
          ctx.beginPath()
          ctx.arc(gs.drone.x + 6, gs.drone.y + 5, 2.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // ── Score floaters ──
      for (const sf of gs.scoreFloaters) {
        ctx.save()
        ctx.globalAlpha = sf.life / sf.maxLife
        ctx.fillStyle = '#FFD700'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'center'

        ctx.fillText(sf.text, sf.x, sf.y)
        ctx.restore()
      }

      // ── HUD ──
      ctx.save()

      // Score
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 18px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`Score: ${gs.player.score}`, 12, 28)

      // Wave / Level indicator (displays cycle number for repeated loops)
      const currentWaveNum = gs.bossesDefeated + 1
      const cycleNum = Math.floor(gs.bossesDefeated / BOSS_DEFINITIONS.length) + 1
      const waveLabel = `WAVE ${currentWaveNum} (L${cycleNum})`
      ctx.fillStyle = '#AADDFF'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(waveLabel, CANVAS_W / 2, 20)

      // Combo
      if (gs.combo > 1) {
        ctx.fillStyle = '#FFD700'
        ctx.font = 'bold 14px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`x${gs.combo} COMBO`, 12, 48)
      }

      // Lives
      ctx.fillStyle = '#FF4444'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'right'
      let livesStr = ''
      for (let i = 0; i < gs.player.lives; i++) livesStr += '❤ '
      ctx.fillText(livesStr, CANVAS_W - 12, 28)

      // Character name
      ctx.fillStyle = stats.color
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(stats.name.toUpperCase(), CANVAS_W - 12, 46)

      // Active buffs
      let buffY = 62
      ctx.font = '11px monospace'
      ctx.textAlign = 'right'
      if (gs.player.rageTimer > 0) {
        ctx.fillStyle = '#FF4400'
        ctx.fillText('🔥 RAGE', CANVAS_W - 12, buffY)
        buffY += 16
      }
      if (gs.player.shieldActive) {
        ctx.fillStyle = '#44DDFF'
        ctx.fillText('🛡 SHIELD', CANVAS_W - 12, buffY)
        buffY += 16
      }
      if (gs.player.doubleShot) {
        ctx.fillStyle = '#FFAA00'
        ctx.fillText('⚡ DOUBLE', CANVAS_W - 12, buffY)
      }

      ctx.restore()

      // ── Game Over overlay ──
      if (gs.gameOver) {
        ctx.save()
        const fadeIn = Math.min(gs.gameOverTimer / 40, 1)
        ctx.globalAlpha = fadeIn * 0.7
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

        ctx.globalAlpha = fadeIn
        ctx.fillStyle = '#FF4444'
        ctx.font = 'bold 36px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30)

        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 20px monospace'
        ctx.fillText(
          `Final Score: ${gs.player.score}`,
          CANVAS_W / 2,
          CANVAS_H / 2 + 20
        )

        ctx.fillStyle = '#888888'
        ctx.font = '14px monospace'
        ctx.fillText(
          `${stats.name} • ${playerData?.name || 'Player'}`,
          CANVAS_W / 2,
          CANVAS_H / 2 + 50
        )

        ctx.restore()
        // Replay / "new game" is handled by the React end-credits overlay once
        // both players have finished — no per-panel restart here.
      }

      ctx.restore() // End shake translation

      // ── BOSS WARNING overlay (drawn outside shake for stability) ──
      if (gs.bossIncoming !== null) {
        const blink = Math.sin(gs.frame * 0.28) > 0
        ctx.save()

        // Red screen vignette pulse
        ctx.fillStyle = `rgba(200,0,0,${0.08 + 0.07 * Math.sin(gs.frame * 0.3)})`
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

        // WARNING text
        if (blink) {
          ctx.fillStyle = '#FF2222'
          ctx.font = 'bold 30px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('⚠  WARNING  ⚠', CANVAS_W / 2, CANVAS_H / 2 - 36)
        }

        // Boss name
        const bossName = BOSS_DEFINITIONS[gs.bossIncoming]?.name ?? ''
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 21px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${bossName} APPROACHES`, CANVAS_W / 2, CANVAS_H / 2 + 4)

        // Countdown bar
        const filled = 1 - gs.bossIncomingTimer / 160
        const bw = 220, bh = 8
        const bx2 = CANVAS_W / 2 - bw / 2
        const by2 = CANVAS_H / 2 + 36
        ctx.fillStyle = '#333'
        ctx.fillRect(bx2, by2, bw, bh)
        ctx.fillStyle = '#FF3333'
        ctx.fillRect(bx2, by2, bw * filled, bh)
        ctx.strokeStyle = '#FF6666'
        ctx.lineWidth = 1
        ctx.strokeRect(bx2, by2, bw, bh)

        ctx.restore()
      }
    } // end render()

    // 🔊 Start music when game begins
    if (audioRef.current) {
      audioRef.current.ensureContext()
      audioRef.current.playStartJingle()
      setTimeout(() => {
        if (audioRef.current) audioRef.current.startMusic()
      }, 500)
    }

    // ── Animation frame loop (fixed 60Hz step for frame-rate independence) ──
    let frameId
    let lastTime = performance.now()
    let accumulator = 0
    const timestep = 1000 / 60 // 16.67ms per update

    function loop(currentTime) {
      if (!currentTime) currentTime = performance.now()

      // Shared "Play Again" — rebuild local state when the round advances.
      const storeRound = useShootingStore.getState().round
      if (storeRound !== seenRound) {
        seenRound = storeRound
        gs = createGameState()
        gameStateRef.current = gs
        if (audioRef.current) {
          audioRef.current.playStartJingle()
          audioRef.current.startMusic()
        }
      }

      let dt = currentTime - lastTime
      if (dt > 1000) dt = timestep // Cap dt to prevent spiral of death
      lastTime = currentTime
      accumulator += dt

      while (accumulator >= timestep) {
        update()
        accumulator -= timestep
      }
      render()
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(frameId)
      // 🔊 Stop music when effect cleans up
      if (audioRef.current) {
        audioRef.current.stopMusic()
        audioRef.current.stopSiren()
      }
    }
  }, [canvasId, isLeftPanel, myKey, getCharacterStats, playerData, pressedKeys, isPlaying, currentDiff])

  const stats = getCharacterStats()
  const charKey = playerData?.avatarKey || 'joy'

  // Character cards for the end-credits roll (color/glow live on CHARACTERS).
  const myChar = CHARACTERS.find((c) => c.id === playerData?.avatarKey) ?? CHARACTERS[0]
  const oppChar = CHARACTERS.find((c) => c.id === oppData?.avatarKey) ?? CHARACTERS[1]
  const myName = playerData?.name || (isLeftPanel ? 'Player 1' : 'Player 2')
  const oppName = oppData?.name || (isLeftPanel ? 'Player 2' : 'Player 1')

  const controlsInfo = isLeftPanel
    ? [
      { action: 'Move Up', key: 'W' },
      { action: 'Move Down', key: 'S' },
      { action: 'Move Left', key: 'A' },
      { action: 'Move Right', key: 'D' },
      { action: 'Shoot', key: 'G' },
    ]
    : [
      { action: 'Move Up', key: 'I / ↑' },
      { action: 'Move Down', key: 'K / ↓' },
      { action: 'Move Left', key: 'J / ←' },
      { action: 'Move Right', key: 'L / →' },
      { action: 'Shoot', key: "' / 5" },
    ]

  function handleLaunch() {
    if (bothAgreed) {
      window.dispatchEvent(new CustomEvent('shooting-start-sync'));
      setIsPlaying(true);
    }
  }

  const handleMuteToggle = () => {
    if (audioRef.current) {
      audioRef.current.ensureContext()
      const newMuted = audioRef.current.toggleMute()
      setIsMuted(newMuted)
    }
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#0a0a1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <canvas
        id={canvasId}
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{
          width: '100%',
          height: 'auto',
          maxHeight: '100%',
          display: 'block',
          imageRendering: 'pixelated',
        }}
      />

      {/* ── MUTE TOGGLE BUTTON ── */}
      {isPlaying && (
        <button
          onClick={handleMuteToggle}
          title={isMuted ? 'Unmute' : 'Mute'}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(10, 10, 30, 0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: isMuted ? '#FF6666' : '#AACCFF',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(10, 10, 30, 0.75)'
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(10, 10, 30, 0.55)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      )}

      {/* ── START MENU OVERLAY ── */}
      {!isPlaying && isLeftPanel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FDF6EC',
            zIndex: 100,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            color: '#1a1a2e',
            overflow: 'auto',
          }}
        >
          {/* Decorative background shapes */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.06 }}>
              <circle cx="15%" cy="18%" r="22" fill="none" stroke="#a0845c" strokeWidth="1.5" />
              <path d="M 80% 12% m -10,10 l 20,0 l -10,-17 Z" fill="#a0845c" />
              <path d="M 20,200 Q 40,185 60,200 Q 80,215 100,200" stroke="#a0845c" strokeWidth="1.5" fill="none" />
              <text x="82%" y="28%" fontSize="13" fill="#a0845c" fontWeight="400">×</text>
              <text x="10%" y="75%" fontSize="13" fill="#a0845c" fontWeight="400">×</text>
              <circle cx="88%" cy="65%" r="16" fill="none" stroke="#a0845c" strokeWidth="1.5" />
              <path d="M 30,420 Q 55,405 80,420 Q 105,435 130,420" stroke="#a0845c" strokeWidth="1.5" fill="none" />
              <text x="72%" y="82%" fontSize="13" fill="#a0845c" fontWeight="400">×</text>
            </svg>
          </div>

          <div style={{ display: 'flex', width: '100%', maxWidth: '900px', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
            {/* Player 1 Card/Controls */}
            <div style={{ width: '250px', textAlign: 'center' }}>
               <div style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: '#b8a898', marginBottom: '6px', fontWeight: 600 }}>Player 1</div>
               <div style={{ fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', color: (CHARACTER_STATS[player1?.avatarKey || 'joy'] || DEFAULT_STATS).color }}>{player1?.name || 'Player 1'}</div>
               <div style={{ marginTop: '24px', padding: '16px', background: '#fff', border: '1.5px solid #e6d9c8', borderRadius: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '3px', color: '#b8a898', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>Controls</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { action: 'Move Up', key: 'W' },
                      { action: 'Move Down', key: 'S' },
                      { action: 'Move Left', key: 'A' },
                      { action: 'Move Right', key: 'D' },
                      { action: 'Shoot', key: 'G' },
                    ].map((ctrl) => (
                      <div key={ctrl.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>{ctrl.action}</span>
                        <span style={{ padding: '3px 10px', background: '#f5ede0', border: '1px solid #ddd0bc', borderBottom: '2.5px solid #c8b89e', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#6a5840', fontFamily: "'SF Mono', 'Consolas', monospace" }}>{ctrl.key}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Middle: Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '320px' }}>
               <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#b8a898', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>Select Level</div>
               <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  {Object.entries(DIFFICULTY_PRESETS).map(([key, preset]) => {
                    const isSelected = currentDiff === key
                    return (
                      <button
                        key={key}
                        onClick={() => selectDifficulty(key)}
                        style={{
                          flex: 1, padding: '14px 6px 12px', border: isSelected ? `2px solid ${preset.color}` : '2px solid #e6d9c8',
                          borderRadius: '12px', background: isSelected ? `${preset.color}18` : '#fff', color: isSelected ? preset.color : '#b8a898',
                          cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit', textAlign: 'center',
                          boxShadow: isSelected ? `0 4px 14px ${preset.color}28` : '0 1px 4px rgba(0,0,0,0.05)',
                          transform: isSelected ? 'translateY(-2px)' : 'translateY(0)',
                        }}
                      >
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>{preset.icon}</div>
                        <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px' }}>{preset.label}</div>
                        <div style={{ fontSize: '9px', marginTop: '4px', opacity: 0.75, lineHeight: 1.4, color: isSelected ? preset.color : '#c0b0a0' }}>{preset.desc}</div>
                      </button>
                    )
                  })}
               </div>
               
               <button
                 onClick={handleLaunch}
                 disabled={!bothAgreed}
                 style={{
                   marginTop: '32px', padding: '14px 48px', fontSize: '14px', fontWeight: 800, letterSpacing: '2.5px',
                   textTransform: 'uppercase', color: bothAgreed ? '#fff' : '#c8b89e', background: bothAgreed ? '#F5A623' : '#ede3d4',
                   border: 'none', borderRadius: '12px', cursor: bothAgreed ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                   boxShadow: bothAgreed ? `0 4px 20px rgba(245, 166, 35, 0.4), 0 1px 0 rgba(255,255,255,0.2) inset` : 'none',
                   transition: 'all 0.25s ease',
                 }}
               >
                 {bothAgreed ? 'Begin' : 'Select a Level'}
               </button>
               {bothAgreed && (
                 <p style={{ fontSize: '10px', color: '#b8a898', marginTop: '12px', letterSpacing: '1px' }}>or press your SHOOT key to start</p>
               )}
            </div>

            {/* Player 2 Card/Controls */}
            <div style={{ width: '250px', textAlign: 'center' }}>
               <div style={{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: '#b8a898', marginBottom: '6px', fontWeight: 600 }}>Player 2</div>
               <div style={{ fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', color: (CHARACTER_STATS[player2?.avatarKey || 'joy'] || DEFAULT_STATS).color }}>{player2?.name || 'Player 2'}</div>
               <div style={{ marginTop: '24px', padding: '16px', background: '#fff', border: '1.5px solid #e6d9c8', borderRadius: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '3px', color: '#b8a898', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600 }}>Controls</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { action: 'Move Up', key: 'I / ↑' },
                      { action: 'Move Down', key: 'K / ↓' },
                      { action: 'Move Left', key: 'J / ←' },
                      { action: 'Move Right', key: 'L / →' },
                      { action: 'Shoot', key: "' / 5" },
                    ].map((ctrl) => (
                      <div key={ctrl.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>{ctrl.action}</span>
                        <span style={{ padding: '3px 10px', background: '#f5ede0', border: '1px solid #ddd0bc', borderBottom: '2.5px solid #c8b89e', borderRadius: '6px', fontSize: '12px', fontWeight: 700, color: '#6a5840', fontFamily: "'SF Mono', 'Consolas', monospace" }}>{ctrl.key}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>

          {/* Booth-style orange wave footer */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', pointerEvents: 'none' }}>
            <svg viewBox="0 0 400 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
              <path d="M0,32 Q100,8 200,32 Q300,56 400,32 L400,64 L0,64 Z" fill="#F5A623" opacity="0.45" />
              <path d="M0,40 Q100,18 200,40 Q300,62 400,40 L400,64 L0,64 Z" fill="#F5A623" opacity="0.65" />
              <path d="M0,50 Q100,32 200,50 Q300,68 400,52 L400,64 L0,64 Z" fill="#F5A623" />
            </svg>
          </div>
        </div>
      )}

      {/* Finished, waiting for the rival to fall before the credits roll */}
      {isPlaying && myFinished && !matchWinner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10,8,16,0.82)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 56, color: myChar.color }}>
            hourglass_top
          </span>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, marginTop: 14, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Final Score: {myFinalScore}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif" }}>
            Waiting for {oppName}…
          </div>
        </div>
      )}

      {/* End credits — both pilots have fallen */}
      {isPlaying && matchWinner && (
        <EndCredits
          title="Shooting"
          outcome={matchWinner === 'tie' ? 'tie' : matchWinner === myKey ? 'win' : 'lose'}
          isPlayer1={isLeftPanel}
          valueLabel="Score"
          myChar={myChar}
          myName={myName}
          myValue={myFinalScore}
          oppChar={oppChar}
          oppName={oppName}
          oppValue={oppFinalScore}
          playAgainKey={null}
          onPlayAgain={() => useShootingStore.getState().restart()}
          onBackToSelect={() => setPhase('CHARACTER_SELECT')}
        />
      )}
    </div>
  )
}