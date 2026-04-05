/**
 * Tracer — Canvas rendering: grid, maze walls, start/end nodes, player, trails.
 * Thick rounded lines; circular nodes.
 */

import { N, E, S, W } from './maze.js';

const GRID_COLOR = 'rgba(78, 78, 78, 0.4)';
const WALL_COLOR = '#6E6E6E';
const WALL_LINE_WIDTH = 2;
const NODE_RADIUS = 0.35; // in cell units (start)
const TRAIL_WIDTH = 0.35;
const PLAYER_RADIUS = 0.25;
const TRAIL_FADE_NEAR = 1;
const TRAIL_FADE_FAR = 0.12;

/**
 * Get canvas size so the full maze fits in the viewport. Cells stay square.
 */
function getCanvasSize(size) {
  const hPad = 32; // 2 × 1rem horizontal padding in gameplay screen
  const maxSide = Math.min(
    typeof window !== 'undefined' ? window.innerWidth - hPad : 800,
    typeof window !== 'undefined' ? window.innerHeight - 120 : 600,
    520
  );
  const cellPx = Math.max(12, Math.floor(maxSide / size));
  const side = size * cellPx;
  return { width: side, height: side, cellPx };
}

/**
 * Draw the grid (thin lines).
 */
function drawGrid(ctx, size, cellPx) {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellPx, 0);
    ctx.lineTo(i * cellPx, size * cellPx);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * cellPx);
    ctx.lineTo(size * cellPx, i * cellPx);
    ctx.stroke();
  }
}

/**
 * Draw maze walls from grid bitmask. Clearly visible lines.
 */
function drawWalls(ctx, grid, size, cellPx, wallColor = WALL_COLOR) {
  ctx.strokeStyle = wallColor;
  ctx.lineWidth = Math.max(WALL_LINE_WIDTH, Math.floor(cellPx * 0.12));
  ctx.lineCap = 'round';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const w = grid[y][x];
      const cx = x * cellPx;
      const cy = y * cellPx;
      if (w & N) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + cellPx, cy);
        ctx.stroke();
      }
      if (w & W) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy + cellPx);
        ctx.stroke();
      }
    }
  }
  ctx.beginPath();
  ctx.moveTo(0, size * cellPx);
  ctx.lineTo(size * cellPx, size * cellPx);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * cellPx, 0);
  ctx.lineTo(size * cellPx, size * cellPx);
  ctx.stroke();
}

/**
 * Draw a 5-pointed star centered at (cx, cy).
 */
function drawStar(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
}

/**
 * Draw start and end nodes. Start = small filled circle. End = star.
 */
function drawNodes(ctx, start, end, size, cellPx, trailColor) {
  const startR = cellPx * NODE_RADIUS;
  const startPx = (start[0] + 0.5) * cellPx;
  const startPy = (start[1] + 0.5) * cellPx;
  ctx.beginPath();
  ctx.arc(startPx, startPy, startR, 0, Math.PI * 2);
  ctx.fillStyle = trailColor;
  ctx.fill();
  ctx.strokeStyle = trailColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  const endPx = (end[0] + 0.5) * cellPx;
  const endPy = (end[1] + 0.5) * cellPx;
  drawStar(ctx, endPx, endPy, cellPx * 0.38, cellPx * 0.16);
  ctx.fillStyle = trailColor;
  ctx.fill();
  ctx.strokeStyle = '#F5F5F5';
  ctx.lineWidth = Math.max(1.5, cellPx * 0.08);
  ctx.stroke();
}

/**
 * Draw trail. If fade is true: heat-map (old faded, new bright). Recap uses fade false.
 */
function drawTrail(ctx, trail, size, cellPx, trailColor, fade = true) {
  if (trail.length < 2) return;
  const w = cellPx * TRAIL_WIDTH;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const n = trail.length;
  for (let i = 0; i < n - 1; i++) {
    if (fade) {
      const t = (i + 1) / n;
      ctx.globalAlpha = TRAIL_FADE_FAR + (TRAIL_FADE_NEAR - TRAIL_FADE_FAR) * t;
    }
    const [x0, y0] = trail[i];
    const [x1, y1] = trail[i + 1];
    ctx.strokeStyle = trailColor;
    ctx.beginPath();
    ctx.moveTo((x0 + 0.5) * cellPx, (y0 + 0.5) * cellPx);
    ctx.lineTo((x1 + 0.5) * cellPx, (y1 + 0.5) * cellPx);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw player. (x, y) can be fractional for smooth interpolation (cell coords).
 */
function drawPlayer(ctx, x, y, cellPx, trailColor) {
  const px = x * cellPx;
  const py = y * cellPx;
  const r = cellPx * PLAYER_RADIUS;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = trailColor;
  ctx.fill();
  ctx.strokeStyle = '#F5F5F5';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/**
 * Full frame: grid, walls, trail, nodes, player.
 * playerVisualPos: [x, y] in cell coords (fractional for smooth movement).
 */
function renderMaze(ctx, maze, trail, playerVisualPos, trailColor, cellPx, wallColor) {
  const { grid, size, start, end } = maze;
  const w = size * cellPx;
  const h = size * cellPx;
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, size, cellPx);
  drawWalls(ctx, grid, size, cellPx, wallColor);
  drawTrail(ctx, trail, size, cellPx, trailColor);
  drawNodes(ctx, start, end, size, cellPx, trailColor);
  drawPlayer(ctx, playerVisualPos[0], playerVisualPos[1], cellPx, trailColor);
}

/**
 * Render a small recap panel (maze + trail only, no player).
 */
function renderRecapPanel(ctx, maze, trail, trailColor, widthPx, wallColor) {
  const { grid, size, start, end } = maze;
  const cellPx = widthPx / size;
  const side = size * cellPx;
  ctx.clearRect(0, 0, side, side);
  drawGrid(ctx, size, cellPx);
  drawWalls(ctx, grid, size, cellPx, wallColor);
  drawTrail(ctx, trail, size, cellPx, trailColor, true);
  drawNodes(ctx, start, end, size, cellPx, trailColor);
}

export {
  getCanvasSize,
  drawGrid,
  drawWalls,
  drawNodes,
  drawTrail,
  drawPlayer,
  renderMaze,
  renderRecapPanel,
};
