/**
 * Tracer — Game state, timer, maze progression, movement validation.
 */

import { N, E, S, W } from './maze.js';

const DIR_DX = { n: 0, s: 0, e: 1, w: -1 };
const DIR_DY = { n: -1, s: 1, e: 0, w: 0 };
const WALL_FOR_DIR = { n: N, s: S, e: E, w: W };

/**
 * Check if from (x,y) we can move in direction dir (no wall).
 */
function canMove(grid, size, x, y, dir) {
  const w = WALL_FOR_DIR[dir];
  if (grid[y][x] & w) return false;
  const nx = x + DIR_DX[dir];
  const ny = y + DIR_DY[dir];
  return nx >= 0 && nx < size && ny >= 0 && ny < size;
}

/**
 * Create game controller: state, timer, progression, move validation.
 * Expects: mazes[], onStateChange(state), onMazeComplete(index, splitTime), onRunComplete(splits, totalMs).
 */
function createGame(mazes, callbacks) {
  const { onStateChange, onMazeComplete, onRunComplete } = callbacks;
  let mazeIndex = 0;
  let trail = [];
  let playerPos = [0, 0];
  let timerStart = 0;
  let totalStart = 0;
  let splits = [];
  let timerId = null;
  let transitioning = false;

  function getMaze() {
    return mazes[mazeIndex];
  }

  function startRun() {
    mazeIndex = 0;
    splits = [];
    totalStart = performance.now();
    startMaze();
  }

  function startMaze() {
    const maze = getMaze();
    if (!maze) return;
    playerPos = [maze.start[0], maze.start[1]];
    trail = [[maze.start[0], maze.start[1]]];
    timerStart = performance.now();
    onStateChange({
      mazeIndex,
      maze,
      playerPos,
      trail,
      splits,
      totalMs: 0,
      currentSplitMs: 0,
    });
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 50);
  }

  function tick() {
    const totalMs = Math.floor(performance.now() - totalStart);
    const currentSplitMs = Math.floor(performance.now() - timerStart);
    onStateChange({
      mazeIndex,
      maze: getMaze(),
      playerPos,
      trail,
      splits,
      totalMs,
      currentSplitMs,
    });
  }

  function tryMove(dir) {
    if (transitioning) return;
    const maze = getMaze();
    if (!maze) return;
    const { grid, size, end } = maze;
    const [x, y] = playerPos;
    if (!canMove(grid, size, x, y, dir)) return;
    const nx = x + DIR_DX[dir];
    const ny = y + DIR_DY[dir];
    doMove(nx, ny, end);
  }

  /** Move to adjacent cell (nx, ny). Used by keyboard and pointer. */
  function tryMoveToCell(nx, ny) {
    if (transitioning) return false;
    const maze = getMaze();
    if (!maze) return false;
    const { grid, size, end } = maze;
    const [x, y] = playerPos;
    const dx = nx - x;
    const dy = ny - y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    const dir = dx === 1 ? 'e' : dx === -1 ? 'w' : dy === 1 ? 's' : 'n';
    if (!canMove(grid, size, x, y, dir)) return false;
    doMove(nx, ny, end);
    return true;
  }

  function doMove(nx, ny, end) {
    playerPos = [nx, ny];
    trail.push([nx, ny]);
    if (nx === end[0] && ny === end[1]) {
      finishMaze();
    }
  }

  function finishMaze() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    transitioning = true;
    const splitMs = Math.floor(performance.now() - timerStart);
    const completedIndex = mazeIndex;
    splits.push(splitMs);
    onMazeComplete(completedIndex, splitMs, [...trail]);
    if (completedIndex + 1 >= mazes.length) {
      const totalMs = Math.floor(performance.now() - totalStart);
      onRunComplete(splits, totalMs);
    } else {
      setTimeout(() => {
        mazeIndex = completedIndex + 1;
        transitioning = false;
        startMaze();
      }, 800);
    }
  }

  function getState() {
    const totalMs = timerStart ? Math.floor(performance.now() - totalStart) : 0;
    const currentSplitMs = timerStart ? Math.floor(performance.now() - timerStart) : 0;
    return {
      mazeIndex,
      maze: getMaze(),
      playerPos,
      trail,
      splits,
      totalMs,
      currentSplitMs,
    };
  }

  return {
    startRun,
    startMaze,
    tryMove,
    tryMoveToCell,
    getState,
    getMaze,
  };
}

/**
 * Format ms as M:SS.cc
 */
function formatTime(ms) {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export { createGame, canMove, formatTime };
