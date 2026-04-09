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
  // Outer ring in trail color keeps theme identity
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = trailColor;
  ctx.fill();
  // Dark border separates player from the trail beneath
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // White core always visible against trail
  ctx.beginPath();
  ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
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

/**
 * Blind mode: only the start/end nodes are visible.
 * Player shown only before first move (trail still at length 1).
 */
function renderBlindMaze(ctx, maze, trail, playerVisualPos, trailColor, cellPx, atStart) {
  const { size, start, end } = maze;
  ctx.clearRect(0, 0, size * cellPx, size * cellPx);
  drawNodes(ctx, start, end, size, cellPx, trailColor);
  if (atStart) {
    drawPlayer(ctx, playerVisualPos[0], playerVisualPos[1], cellPx, trailColor);
  }
}

/**
 * Dark mode: flashlight effect — only a circular area around the player is
 * visible. Uses an off-screen canvas mask with a radial gradient so the
 * edge fades softly. Nodes appear inside the light; player always visible.
 */
function renderDarkMaze(ctx, maze, trail, playerVisualPos, trailColor, cellPx, wallColor) {
  const { grid, size, start, end } = maze;
  const w = size * cellPx;
  ctx.clearRect(0, 0, w, w);
  drawGrid(ctx, size, cellPx);
  drawWalls(ctx, grid, size, cellPx, wallColor);
  drawTrail(ctx, trail, size, cellPx, trailColor, true);
  drawNodes(ctx, start, end, size, cellPx, trailColor);

  // Darkness mask with a soft flashlight hole around the player
  const px = playerVisualPos[0] * cellPx;
  const py = playerVisualPos[1] * cellPx;
  const innerR = cellPx * 0.8;
  const outerR = cellPx * 1.75;
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = w;
  const mctx = mask.getContext('2d');
  mctx.fillStyle = '#0A0A0A';
  mctx.fillRect(0, 0, w, w);
  mctx.globalCompositeOperation = 'destination-out';
  const gr = mctx.createRadialGradient(px, py, innerR, px, py, outerR);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  mctx.fillStyle = gr;
  mctx.fillRect(0, 0, w, w);
  ctx.drawImage(mask, 0, 0);

  drawPlayer(ctx, playerVisualPos[0], playerVisualPos[1], cellPx, trailColor);
}

/**
 * DDA ray cast from (px, py) at the given angle.
 * Returns { dist, side } where dist is the perpendicular wall distance
 * and side is 0 (hit a vertical boundary) or 1 (horizontal boundary).
 */
function castRayFP(grid, size, px, py, angle) {
  const rdx = Math.cos(angle);
  const rdy = Math.sin(angle);
  let mx = Math.floor(px);
  let my = Math.floor(py);
  const ddx = Math.abs(rdx) < 1e-10 ? 1e30 : Math.abs(1 / rdx);
  const ddy = Math.abs(rdy) < 1e-10 ? 1e30 : Math.abs(1 / rdy);
  let stepX, stepY, sdx, sdy;
  if (rdx < 0) { stepX = -1; sdx = (px - mx) * ddx; }
  else         { stepX =  1; sdx = (mx + 1 - px) * ddx; }
  if (rdy < 0) { stepY = -1; sdy = (py - my) * ddy; }
  else         { stepY =  1; sdy = (my + 1 - py) * ddy; }
  let hit = false, side = 0;
  const maxSteps = size * 3;
  for (let i = 0; i < maxSteps && !hit; i++) {
    if (sdx < sdy) {
      sdx += ddx; mx += stepX; side = 0;
      if (mx < 0 || mx >= size) { hit = true; break; }
      if (grid[my][mx] & (stepX > 0 ? W : E)) hit = true;
    } else {
      sdy += ddy; my += stepY; side = 1;
      if (my < 0 || my >= size) { hit = true; break; }
      if (grid[my][mx] & (stepY > 0 ? N : S)) hit = true;
    }
  }
  // perpDist: projection used for wall height (corrects fish-eye)
  const perpDist = Math.max(0.01, side === 0 ? sdx - ddx : sdy - ddy);
  // actualDist: true Euclidean travel distance, needed for accurate sprite/marker occlusion
  const wallX = mx + (stepX > 0 ? 0 : 1);
  const wallY = my + (stepY > 0 ? 0 : 1);
  const actualDist = Math.max(0.01, side === 0 ? (wallX - px) / rdx : (wallY - py) / rdy);
  return { dist: perpDist, actualDist, side };
}

/**
 * First-person raycasted view of the maze.
 * playerCell: [cx, cy] integer cell. facingAngle: radians (0=East, PI/2=South).
 * trailColor: active trail color used for the exit floor marker.
 */
function renderFirstPerson(ctx, maze, playerCell, facingAngle, wallColor, trailColor, canvasW, canvasH) {
  const { grid, size, end } = maze;
  const px = playerCell[0] + 0.5;
  const py = playerCell[1] + 0.5;
  const baseColor = wallColor || WALL_COLOR;
  const FOV = Math.PI / 3; // 60°

  // 1. Ceiling (cool dark) and floor (warm dark)
  ctx.fillStyle = '#06060F';
  ctx.fillRect(0, 0, canvasW, canvasH / 2);
  ctx.fillStyle = '#0F0904';
  ctx.fillRect(0, canvasH / 2, canvasW, canvasH / 2);

  // 2. Exit marker — drawn BEFORE walls so the wall columns naturally occlude it.
  //    No explicit ray test needed; the painter's algorithm handles it correctly.
  const [ex, ey] = end;
  const dex = ex + 0.5 - px;
  const dey = ey + 0.5 - py;
  const exitDist = Math.sqrt(dex * dex + dey * dey);
  const exitAngle = Math.atan2(dey, dex);
  let angleOff = exitAngle - facingAngle;
  while (angleOff >  Math.PI) angleOff -= 2 * Math.PI;
  while (angleOff < -Math.PI) angleOff += 2 * Math.PI;

  if (Math.abs(angleOff) < FOV / 2 + 0.15) {
    const screenX = Math.round(canvasW * (0.5 + angleOff / FOV));
    const rawFloorY = canvasH / 2 + canvasH / (2 * Math.max(exitDist, 0.5));
    const floorY = Math.min(canvasH * 0.88, rawFloorY);
    const r = Math.min(canvasH * 0.07, canvasH * 0.13 / exitDist);
    const squish = 0.32; // flatten Y to simulate lying flat on the floor
    const alpha = Math.min(0.95, 0.9 / (exitDist * 0.12 + 0.2));
    // Soft glow ellipse underneath
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = trailColor;
    ctx.beginPath();
    ctx.ellipse(screenX, floorY, r * 2.2, r * squish * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Star path with Y squished to look flat on the ground
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const sr = i % 2 === 0 ? r : r * 0.42;
      const vx = screenX + sr * Math.cos(a);
      const vy = floorY  + sr * Math.sin(a) * squish;
      i === 0 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 3. Wall columns — drawn after the exit marker so they occlude it correctly.
  //    Each strip gets an opaque black backing first so the wall is never
  //    semi-transparent over the marker behind it.
  for (let col = 0; col < canvasW; col++) {
    const rayAngle = facingAngle + (col / canvasW - 0.5) * FOV;
    const { dist, side } = castRayFP(grid, size, px, py, rayAngle);
    const wallH = Math.min(canvasH, Math.floor(canvasH / dist));
    const wallTop = Math.floor((canvasH - wallH) / 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(col, wallTop, 1, wallH);
    const shade = Math.max(0.08, Math.min(1, 1.4 / (dist + 0.4)));
    ctx.globalAlpha = shade * (side === 1 ? 0.6 : 1.0);
    ctx.fillStyle = baseColor;
    ctx.fillRect(col, wallTop, 1, wallH);
  }
  ctx.globalAlpha = 1;

  // 4. Vignette — darkens top/bottom bands so the horizon reads even against a close wall
  const vign = ctx.createLinearGradient(0, 0, 0, canvasH);
  vign.addColorStop(0,    'rgba(0,0,0,0.92)');
  vign.addColorStop(0.14, 'rgba(0,0,0,0)');
  vign.addColorStop(0.86, 'rgba(0,0,0,0)');
  vign.addColorStop(1,    'rgba(0,0,0,0.92)');
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, canvasW, canvasH);
}

/**
 * Render the glyph: all 6 trails overlaid on the same square canvas,
 * no walls or grid. Screen blending makes overlapping paths brighten.
 */
function renderGlyph(ctx, mazes, trails, colors, sizePx) {
  ctx.clearRect(0, 0, sizePx, sizePx);
  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, sizePx, sizePx);
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'screen';
  mazes.forEach((maze, i) => {
    const trail = trails[i] || [];
    if (trail.length < 2) return;
    const cellPx = sizePx / maze.size;
    drawTrail(ctx, trail, maze.size, cellPx, colors[i], false);
  });
  ctx.globalCompositeOperation = prev;
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
  renderGlyph,
  renderBlindMaze,
  renderDarkMaze,
  renderFirstPerson,
};
