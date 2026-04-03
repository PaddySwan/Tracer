/**
 * Tracer — Maze generation and daily seed logic.
 * Deterministic mazes via seeded RNG; recursive backtracking.
 */

const MAZE_SIZES = [7, 8, 9, 10, 11, 12]; // 6 mazes; small and quick
const TRAIL_COLORS = ['#1D4DFF', '#FF2A1A', '#F4F000', '#FFAA00', '#00A62E', '#B84DFF'];
const TRAIL_EMOJIS = ['🔵', '🔴', '🟡', '🟠', '🟢', '🟣'];

// --- Holiday theming ---

function _easterDate(year) {
  // Meeus/Jones/Butcher algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function _thanksgivingDay(year) {
  // 4th Thursday of November
  const nov1Day = new Date(year, 10, 1).getDay(); // 0=Sun
  const firstThursday = (4 - nov1Day + 7) % 7 + 1;
  return firstThursday + 21;
}

const HOLIDAYS = {
  //                                                                                                              accent       wallColor
  newyear:      { name: "New Year's Day",    greeting: "Happy New Year! 🎆",          accentColor: '#FFD700', wallColor: null,      trailColors: ['#FFD700','#C0C0C0','#1D4DFF','#9B59B6','#FF8C00','#00BFFF'], trailEmojis: ['🌟','🥂','🎊','💫','🎆','✨'] },
  valentine:    { name: "Valentine's Day",   greeting: "Happy Valentine's Day! ❤️",   accentColor: '#FF4D94', wallColor: '#7A1A3A', trailColors: ['#FF1A6B','#FF69B4','#FF0055','#E91E8C','#FF4D94','#C2185B'], trailEmojis: ['❤️','🩷','💖','💕','💗','💝'] },
  stpatricks:   { name: "St. Patrick's Day", greeting: "Happy St. Patrick's Day! 🍀", accentColor: '#34C759', wallColor: '#2A5C2A', trailColors: ['#00A62E','#34C759','#FFD700','#2E7D32','#66BB6A','#FFC107'], trailEmojis: ['🟢','🍀','💚','🌟','🌿','✨'] },
  easter:       { name: 'Easter',            greeting: 'Happy Easter! 🐣',            accentColor: '#C8A2E8', wallColor: '#3D7A2A', trailColors: ['#FF9EBC','#C8A2E8','#98DFC6','#F7E96A','#FFB347','#87CEEB'], trailEmojis: ['🩷','💜','🥚','🐣','🌸','🩵'] },
  independence: { name: 'Independence Day',  greeting: 'Happy 4th of July! 🎇',       accentColor: '#FF2A1A', wallColor: '#2E4A6B', trailColors: ['#FF2A1A','#1D4DFF','#E8E8E8','#CC1111','#4A90D9','#003DA5'], trailEmojis: ['🔴','🔵','⭐','❤️','💙','🌟'] },
  halloween:    { name: 'Halloween',         greeting: 'Happy Halloween! 🎃',          accentColor: '#FF6B00', wallColor: '#3D1A5C', trailColors: ['#FF6B00','#9B59B6','#FF8C00','#7B2FBE','#FFD700','#CC5500'], trailEmojis: ['🎃','🟣','🟠','👻','⭐','🦇'] },
  thanksgiving: { name: 'Thanksgiving',      greeting: 'Happy Thanksgiving! 🦃',       accentColor: '#FF8F00', wallColor: '#3D2000', trailColors: ['#E65100','#FF8F00','#BF360C','#F57F17','#795548','#FF6F00'], trailEmojis: ['🟠','🍂','🦃','🟡','🤎','🍁'] },
  christmas:    { name: 'Christmas',         greeting: 'Merry Christmas! 🎄',          accentColor: '#CC0000', wallColor: '#1A5C1A', trailColors: ['#CC0000','#228B22','#FFD700','#FF3333','#006400','#C0C0C0'], trailEmojis: ['🔴','🟢','⭐','🎄','❄️','🎁'] },
};

function getHoliday(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month === 1  && day === 1)  return HOLIDAYS.newyear;
  if (month === 2  && day === 14) return HOLIDAYS.valentine;
  if (month === 3  && day === 17) return HOLIDAYS.stpatricks;
  const e = _easterDate(year);
  if (month === e.month && day === e.day) return HOLIDAYS.easter;
  if (month === 7  && day === 4)  return HOLIDAYS.independence;
  if (month === 10 && day === 31) return HOLIDAYS.halloween;
  if (month === 11 && day === _thanksgivingDay(year)) return HOLIDAYS.thanksgiving;
  if (month === 12 && day === 25) return HOLIDAYS.christmas;
  return null;
}

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
  getHoliday,
  MAZE_SIZES,
  TRAIL_COLORS,
  TRAIL_EMOJIS,
  N,
  E,
  S,
  W,
  DX,
  DY,
};
