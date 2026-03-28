/**
 * Tracer — Maze generation and daily seed logic.
 * Deterministic mazes via seeded RNG; recursive backtracking.
 */

const MAZE_SIZES = [7, 8, 9, 10, 11, 12]; // 6 mazes; small and quick
const TRAIL_COLORS = ['#1D4DFF', '#FF2A1A', '#F4F000', '#FFAA00', '#00A62E', '#B84DFF'];

// Seeded PRNG (mulberry32)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Get today's seed string (YYYY-MM-DD).
 */
function getDailySeed() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Hash a string to a number for seeding.
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h = h & h;
  }
  return h >>> 0;
}

// Cell walls: N=1, E=2, S=4, W=8 (bitmask)
const N = 1, E = 2, S = 4, W = 8;
const DX = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
const DY = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
const OPPOSITE = { [N]: S, [E]: W, [S]: N, [W]: E };

/**
 * Carve the wall between two adjacent cells (for Wilson's).
 */
function carveBetween(grid, x1, y1, x2, y2) {
  if (x2 === x1 + 1) {
    grid[y1][x1] &= ~E;
    grid[y2][x2] &= ~W;
  } else if (x2 === x1 - 1) {
    grid[y1][x1] &= ~W;
    grid[y2][x2] &= ~E;
  } else if (y2 === y1 + 1) {
    grid[y1][x1] &= ~S;
    grid[y2][x2] &= ~N;
  } else {
    grid[y1][x1] &= ~N;
    grid[y2][x2] &= ~S;
  }
}

/**
 * Wilson's algorithm: loop-erased random walk. Produces uniform spanning tree,
 * so mazes feel fair and natural with good branching and no obvious bias.
 * grid[y][x] = bitmask of present walls (N,E,S,W).
 * Returns { grid, size, start, end } with start/end as [x,y].
 */
function generateMaze(size, random) {
  const grid = Array(size)
    .fill(0)
    .map(() => Array(size).fill(N | E | S | W));

  const inMaze = Array(size * size).fill(false);
  inMaze[0] = true;

  const key = (x, y) => y * size + x;
  const unvisited = [];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (!inMaze[key(x, y)]) unvisited.push([x, y]);

  const dirs = [N, E, S, W];

  while (unvisited.length > 0) {
    const startIdx = Math.floor(random() * unvisited.length);
    const [sx, sy] = unvisited[startIdx];
    let path = [[sx, sy]];
    const pathSet = new Set([key(sx, sy)]);
    let cx = sx, cy = sy;

    while (!inMaze[key(cx, cy)]) {
      const dir = dirs[Math.floor(random() * 4)];
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;

      const nk = key(nx, ny);
      if (pathSet.has(nk)) {
        const idx = path.findIndex(([px, py]) => key(px, py) === nk);
        for (let i = path.length - 1; i > idx; i--) {
          pathSet.delete(key(path[i][0], path[i][1]));
          path.pop();
        }
        cx = nx;
        cy = ny;
        continue;
      }

      if (inMaze[nk]) {
        for (let i = 0; i < path.length; i++) {
          const [px, py] = path[i];
          inMaze[key(px, py)] = true;
          if (i > 0) carveBetween(grid, path[i - 1][0], path[i - 1][1], px, py);
        }
        carveBetween(grid, cx, cy, nx, ny);
        for (let i = unvisited.length - 1; i >= 0; i--) {
          if (inMaze[key(unvisited[i][0], unvisited[i][1])]) {
            unvisited[i] = unvisited[unvisited.length - 1];
            unvisited.pop();
          }
        }
        break;
      }

      path.push([nx, ny]);
      pathSet.add(nk);
      cx = nx;
      cy = ny;
    }
  }

  const cornerPairs = [
    [[0, 0], [size - 1, size - 1]],
    [[size - 1, size - 1], [0, 0]],
    [[size - 1, 0], [0, size - 1]],
    [[0, size - 1], [size - 1, 0]],
  ];
  const [start, end] = cornerPairs[Math.floor(random() * 4)];
  return { grid, size, start, end };
}

/**
 * BFS shortest path length from start to end. Returns cell count.
 */
function shortestPath(maze) {
  const { grid, size, start, end } = maze;
  const visited = new Uint8Array(size * size);
  const key = (x, y) => y * size + x;
  const queue = [[start[0], start[1], 0]];
  visited[key(start[0], start[1])] = 1;
  const dirs = [N, E, S, W];
  while (queue.length > 0) {
    const [x, y, dist] = queue.shift();
    if (x === end[0] && y === end[1]) return dist;
    for (const wall of dirs) {
      if (grid[y][x] & wall) continue;
      const nx = x + DX[wall];
      const ny = y + DY[wall];
      const k = key(nx, ny);
      if (!visited[k]) {
        visited[k] = 1;
        queue.push([nx, ny, dist + 1]);
      }
    }
  }
  return 0;
}

/**
 * Generate all 6 daily mazes from seed (YYYY-MM-DD).
 * Each maze is retried up to 10 times if the shortest path is too short;
 * falls back to the best attempt if none pass.
 */
function generateDailyMazes(seed) {
  const seedNum = hashString(seed);
  const mazes = [];
  for (let i = 0; i < 6; i++) {
    const size = MAZE_SIZES[i];
    const minPath = size * 2; // must traverse at least 2× the grid size
    const MAX_ATTEMPTS = 10;
    let best = null;
    let bestLen = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const rng = mulberry32(seedNum + i * 1000 + attempt * 7);
      const maze = generateMaze(size, rng);
      const len = shortestPath(maze);
      if (len > bestLen) {
        bestLen = len;
        best = maze;
      }
      if (len >= minPath) break;
    }
    mazes.push(best);
  }
  return mazes;
}

export {
  getDailySeed,
  generateDailyMazes,
  generateMaze,
  mulberry32,
  MAZE_SIZES,
  TRAIL_COLORS,
  N,
  E,
  S,
  W,
  DX,
  DY,
};
