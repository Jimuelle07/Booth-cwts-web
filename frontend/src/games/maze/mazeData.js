function seededRng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function placeOrbs(grid, rows, cols, start, exit, rng) {
  // Divide maze height into 3 zones; pick one open cell per zone
  const zones = [[], [], []]
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (
        grid[r][c] === 0 &&
        !(r === start.row && c === start.col) &&
        !(r === exit.row && c === exit.col)
      ) {
        const z = Math.min(Math.floor(((r - 1) / (rows - 2)) * 3), 2)
        zones[z].push({ row: r, col: c })
      }
    }
  }
  return zones.map((zone) => {
    if (zone.length === 0) return { row: start.row, col: start.col + 2 }
    return zone[(rng() * zone.length) | 0]
  })
}

function generateMaze(rows, cols, seed) {
  const rng = seededRng(seed)
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1))
  const cellR = (rows - 1) >> 1
  const cellC = (cols - 1) >> 1
  const visited = Array.from({ length: cellR }, () => Array(cellC).fill(false))

  const DIRS = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]

  const shuffle = (arr) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const carve = (r, c) => {
    visited[r][c] = true
    grid[r * 2 + 1][c * 2 + 1] = 0
    for (const [dr, dc] of shuffle(DIRS)) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < cellR && nc >= 0 && nc < cellC && !visited[nr][nc]) {
        grid[r * 2 + 1 + dr][c * 2 + 1 + dc] = 0
        carve(nr, nc)
      }
    }
  }

  carve(0, 0)

  // Widen entrance (top) and exit (bottom)
  grid[0][1] = 0
  grid[0][2] = 0
  grid[0][3] = 0
  grid[rows - 1][cols - 2] = 0
  grid[rows - 1][cols - 3] = 0
  grid[rows - 1][cols - 4] = 0

  const start = { row: 1, col: 1 }
  const exit = { row: rows - 2, col: cols - 2 }

  // Orb positions placed after maze is carved (rng continues from same seed state)
  const orbPositions = placeOrbs(grid, rows, cols, start, exit, rng)

  return { grid, rows, cols, start, exit, orbPositions }
}

// Inside Out emotion colours — one sequence per level, must collect in this order
export const ORB_SEQUENCES = [
  { colors: ['#FFD700', '#4A90D9', '#27AE60'], names: ['Joy', 'Sadness', 'Disgust'] },
  { colors: ['#9B59B6', '#E03B1F', '#FFD700'], names: ['Fear', 'Anger', 'Joy'] },
  { colors: ['#27AE60', '#9B59B6', '#E03B1F'], names: ['Disgust', 'Fear', 'Anger'] },
]

// 3 levels — Easy (small), Medium, Hard (largest)
export const mazes = [
  generateMaze(11, 11, 91),   // EASY   — 5×5 cells
  generateMaze(15, 15, 314),  // MEDIUM — 7×7 cells
  generateMaze(19, 19, 777),  // HARD   — 9×9 cells
]
