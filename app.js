/**
 * Tracer — App entry: screens, countdown, game loop, recap.
 */

import { getDailySeed, generateDailyMazes, generateMaze, mulberry32, MAZE_SIZES, TRAIL_COLORS, TRAIL_EMOJIS } from './maze.js?v=33';
import { getCanvasSize, renderMaze, renderRecapPanel } from './render.js?v=33';
import { createInputHandler } from './input.js?v=33';
import { createGame, formatTime } from './game.js?v=33';
import { saveRun, loadRun } from './storage.js?v=33';
const REVISION = 33; // Bump when making changes so you know you're on a new version

// DOM
const landing = document.getElementById('landing');
const gameplay = document.getElementById('gameplay');
const results = document.getElementById('results');
const btnStart = document.getElementById('btn-start');
const mazeLabel = document.getElementById('maze-label');
const timerEl = document.getElementById('timer');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const mazeCanvas = document.getElementById('maze-canvas');
const mazeClearOverlay = document.getElementById('maze-clear-overlay');
const splitTimeEl = document.getElementById('split-time');
const splitsFooter = document.getElementById('splits-footer');
const totalTimeEl = document.getElementById('total-time');
const recapPanels = document.getElementById('recap-panels');
const splitsList = document.getElementById('splits-list');
const btnCopy = document.getElementById('btn-copy');
const btnHome = document.getElementById('btn-home');
const btnPractice = document.getElementById('btn-practice');
const btnExitPractice = document.getElementById('btn-exit-practice');
const revisionEl = document.getElementById('revision');
const recapExpandOverlay = document.getElementById('recap-expand-overlay');
const recapExpandCanvas = document.getElementById('recap-expand-canvas');
const recapExpandTitle = document.getElementById('recap-expand-title');
const recapExpandSplit = document.getElementById('recap-expand-split');

let dailySeed;
let dailyMazes;
let mazes;
let game;
let inputHandler;
let completedTrails = [];
let completedSplits = [];
let runTotalMs = 0;

const TWEEN_DURATION = 65; // ms per cell; matches hold-repeat interval for a smooth glide
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

let playerVisualPos = [0.5, 0.5];
let tweenFrom = [0.5, 0.5];
let tweenTo = [0.5, 0.5];
let tweenElapsed = TWEEN_DURATION;
let pendingPos = null;
let lastKnownPos = null;
let rafId = null;
let lastMazeIndex = -1;
let lastFrameTime = 0;
let countdownActive = false;

let practiceActive = false;
let practiceMazeCount = 0;
let practiceSeedBase = 0;

function showScreen(id) {
  landing.classList.remove('active');
  gameplay.classList.remove('active');
  results.classList.remove('active');
  document.getElementById(id).classList.add('active');
}

function runCountdown() {
  showScreen('gameplay');
  const ctx = mazeCanvas.getContext('2d');
  ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
  countdownActive = true;
  countdownOverlay.classList.remove('hidden');
  let n = 3;
  countdownNumber.textContent = n;
  const step = () => {
    n--;
    if (n > 0) {
      countdownNumber.textContent = n;
      setTimeout(step, 1000);
    } else {
      countdownNumber.textContent = 'Go';
      setTimeout(() => {
        countdownOverlay.classList.add('hidden');
        countdownActive = false;
        game.startRun();
        startGameLoop();
      }, 400);
    }
  };
  setTimeout(step, 1000);
}

function tickTween(state, now) {
  if (!state.maze) return;
  const { width, height, cellPx } = getCanvasSize(state.maze.size);
  if (mazeCanvas.width !== width || mazeCanvas.height !== height) {
    mazeCanvas.width = width;
    mazeCanvas.height = height;
  }

  const deltaMs = lastFrameTime > 0 ? now - lastFrameTime : 16;
  lastFrameTime = now;

  // Detect player position change and queue a tween
  const [px, py] = state.playerPos;
  if (!lastKnownPos || lastKnownPos[0] !== px || lastKnownPos[1] !== py) {
    lastKnownPos = [px, py];
    const target = [px + 0.5, py + 0.5];
    if (tweenElapsed < TWEEN_DURATION) {
      pendingPos = target; // overwrite any previously queued move
    } else {
      tweenFrom = [...tweenTo];
      tweenTo = target;
      tweenElapsed = 0;
    }
  }

  // Advance active tween; when it finishes, start any queued move
  if (tweenElapsed < TWEEN_DURATION) {
    tweenElapsed = Math.min(TWEEN_DURATION, tweenElapsed + deltaMs);
  } else if (pendingPos) {
    tweenFrom = [...tweenTo];
    tweenTo = pendingPos;
    pendingPos = null;
    tweenElapsed = Math.min(TWEEN_DURATION, deltaMs);
  }

  const t = easeInOut(tweenElapsed / TWEEN_DURATION);
  playerVisualPos[0] = tweenFrom[0] + (tweenTo[0] - tweenFrom[0]) * t;
  playerVisualPos[1] = tweenFrom[1] + (tweenTo[1] - tweenFrom[1]) * t;

  const ctx = mazeCanvas.getContext('2d');
  const colorIndex = practiceActive ? practiceMazeCount % TRAIL_COLORS.length : state.mazeIndex;
  const color = TRAIL_COLORS[colorIndex];
  renderMaze(ctx, state.maze, state.trail, [...playerVisualPos], color, cellPx);
}

function gameLoop(now) {
  now = now || performance.now();
  const state = game.getState();
  if (!state.maze) {
    rafId = requestAnimationFrame(gameLoop);
    return;
  }
  tickTween(state, now);
  updateUI(state);
  rafId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function updateUI(state) {
  if (practiceActive) {
    mazeLabel.textContent = `Practice · Maze ${practiceMazeCount + 1}`;
  } else {
    mazeLabel.textContent = `Maze ${state.mazeIndex + 1} / ${mazes.length}`;
  }
  timerEl.textContent = formatTime(state.totalMs);
  if (!practiceActive && state.splits.length > 0) {
    splitsFooter.textContent = state.splits.map((ms, i) => `Maze ${i + 1} — ${(ms / 1000).toFixed(2)}`).join(' · ');
  }
}

function showMazeClear(splitMs) {
  splitTimeEl.textContent = (splitMs / 1000).toFixed(2);
  mazeClearOverlay.classList.remove('hidden');
  setTimeout(() => mazeClearOverlay.classList.add('hidden'), 700);
}

function buildResultsScreen() {
  totalTimeEl.textContent = `Total — ${formatTime(runTotalMs)}`;

  recapPanels.innerHTML = '';
  const panelSize = 120;
  mazes.forEach((maze, i) => {
    const trail = completedTrails[i] || [];
    const div = document.createElement('div');
    div.className = 'recap-panel';
    div.dataset.index = String(i);
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Maze ${i + 1}, split ${completedSplits[i] != null ? (completedSplits[i] / 1000).toFixed(2) : '—'}s. Click to expand.`);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const cellPx = panelSize / maze.size;
    canvas.width = maze.size * cellPx;
    canvas.height = maze.size * cellPx;
    renderRecapPanel(ctx, maze, trail, TRAIL_COLORS[i], panelSize);
    const split = completedSplits[i] != null ? (completedSplits[i] / 1000).toFixed(2) : '—';
    div.appendChild(canvas);
    const span = document.createElement('span');
    span.className = 'panel-split';
    span.textContent = split;
    div.appendChild(span);
    recapPanels.appendChild(div);
  });
  recapPanels.querySelectorAll('.recap-panel').forEach((el) => {
    el.addEventListener('click', () => showRecapExpand(parseInt(el.dataset.index, 10)));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showRecapExpand(parseInt(el.dataset.index, 10)); } });
  });

  splitsList.innerHTML = completedSplits
    .map((ms, i) => `${TRAIL_EMOJIS[i]} Maze ${i + 1} — ${(ms / 1000).toFixed(2)}`)
    .join('<br>');
}

function showRecapExpand(index) {
  const maze = mazes[index];
  const trail = completedTrails[index] || [];
  const color = TRAIL_COLORS[index];
  const sizePx = Math.min(420, window.innerWidth - 48, window.innerHeight - 120);
  const cellPx = sizePx / maze.size;
  const w = maze.size * cellPx;
  const h = w;
  recapExpandCanvas.width = w;
  recapExpandCanvas.height = h;
  const ctx = recapExpandCanvas.getContext('2d');
  renderRecapPanel(ctx, maze, trail, color, sizePx);
  recapExpandTitle.textContent = `Maze ${index + 1}`;
  recapExpandSplit.textContent = completedSplits[index] != null ? (completedSplits[index] / 1000).toFixed(2) + 's' : '—';
  recapExpandOverlay.classList.remove('hidden');
  recapExpandOverlay.setAttribute('aria-hidden', 'false');
}

function hideRecapExpand() {
  recapExpandOverlay.classList.add('hidden');
  recapExpandOverlay.setAttribute('aria-hidden', 'true');
}

function copyResult() {
  const dayNum = Math.floor((Date.now() - new Date('2026-01-01T00:00:00Z')) / 86400000) + 1;
  const lines = [
    `Tracer #${dayNum}`,
    '',
    ...completedSplits.map((ms, i) => `${TRAIL_EMOJIS[i]} Maze ${i + 1}: ${formatTime(ms)}`),
    '',
    `Total: ${formatTime(runTotalMs)}`,
  ];
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const label = btnCopy.textContent;
    btnCopy.textContent = 'Copied!';
    btnCopy.disabled = true;
    setTimeout(() => {
      btnCopy.textContent = label;
      btnCopy.disabled = false;
    }, 2000);
  }).catch(() => {});
}

function launchPracticeMaze(autoStart = false) {
  game?.stop();
  const size = MAZE_SIZES[practiceMazeCount % MAZE_SIZES.length];
  const rng = mulberry32(practiceSeedBase + practiceMazeCount * 1337);
  mazes = [generateMaze(size, rng)];
  lastMazeIndex = -1;

  game = createGame(mazes, {
    onStateChange(state) {
      if (state.mazeIndex !== lastMazeIndex) {
        lastMazeIndex = state.mazeIndex;
        const startX = state.playerPos[0] + 0.5;
        const startY = state.playerPos[1] + 0.5;
        playerVisualPos = [startX, startY];
        tweenFrom = [startX, startY];
        tweenTo = [startX, startY];
        tweenElapsed = TWEEN_DURATION;
        pendingPos = null;
        lastKnownPos = [state.playerPos[0], state.playerPos[1]];
        lastFrameTime = 0;
        inputHandler.reset?.();
      }
      updateUI(state);
    },
    onMazeComplete(_index, splitMs) {
      showMazeClear(splitMs);
    },
    onRunComplete() {
      setTimeout(() => {
        practiceMazeCount++;
        launchPracticeMaze(true);
      }, 800);
    },
  });

  if (autoStart) game.startRun();
}

function init() {
  revisionEl.textContent = `Revision ${REVISION}`;
  dailySeed = getDailySeed();
  dailyMazes = generateDailyMazes(dailySeed);
  completedTrails = [];
  completedSplits = [];

  function setupDailyGame() {
    game?.stop();
    mazes = dailyMazes;
    completedTrails = [];
    completedSplits = [];
    game = createGame(dailyMazes, {
      onStateChange(state) {
        if (state.mazeIndex !== lastMazeIndex) {
          lastMazeIndex = state.mazeIndex;
          const startX = state.playerPos[0] + 0.5;
          const startY = state.playerPos[1] + 0.5;
          playerVisualPos = [startX, startY];
          tweenFrom = [startX, startY];
          tweenTo = [startX, startY];
          tweenElapsed = TWEEN_DURATION;
          pendingPos = null;
          lastKnownPos = [state.playerPos[0], state.playerPos[1]];
          lastFrameTime = 0;
          inputHandler.reset?.();
        }
        updateUI(state);
      },
      onMazeComplete(index, splitMs, trail) {
        completedTrails[index] = trail;
        completedSplits[index] = splitMs;
        showMazeClear(splitMs);
      },
      onRunComplete(splits, totalMs) {
        runTotalMs = totalMs;
        saveRun(dailySeed, { splits, totalMs, trails: completedTrails });
        inputHandler.unbind();
        stopGameLoop();
        pointerHandler.unbind();
        buildResultsScreen();
        showScreen('results');
      },
    });
  }

  setupDailyGame();

  inputHandler = createInputHandler((dir) => {
    if (countdownActive) return;
    game.tryMove(dir);
  });

  function getCellFromEvent(e) {
    const rect = mazeCanvas.getBoundingClientRect();
    const state = game.getState();
    if (!state.maze) return null;
    const { cellPx } = getCanvasSize(state.maze.size);
    const scaleX = mazeCanvas.width / rect.width;
    const scaleY = mazeCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const cellX = Math.floor(x / cellPx);
    const cellY = Math.floor(y / cellPx);
    if (cellX < 0 || cellX >= state.maze.size || cellY < 0 || cellY >= state.maze.size) return null;
    return [cellX, cellY];
  }

  const pointerHandler = {
    _cleanup: null,
    bind() {
      if (this._cleanup) {
        this._cleanup();
        this._cleanup = null;
      }
      const onPointer = (e) => {
        if (countdownActive) return;
        const cell = getCellFromEvent(e);
        if (!cell) return;
        if (game.tryMoveToCell(cell[0], cell[1])) {
          const s = game.getState();
          playerVisualPos[0] = s.playerPos[0] + 0.5;
          playerVisualPos[1] = s.playerPos[1] + 0.5;
        }
      };
      const onMove = (e) => {
        if (e.buttons !== 1) return;
        onPointer(e);
      };
      const onTouch = (e) => {
        e.preventDefault();
        const t = e.touches[0];
        if (!t) return;
        onPointer({ clientX: t.clientX, clientY: t.clientY });
      };
      mazeCanvas.addEventListener('mousedown', onPointer);
      mazeCanvas.addEventListener('mousemove', onMove);
      mazeCanvas.addEventListener('touchstart', onTouch, { passive: false });
      mazeCanvas.addEventListener('touchmove', onTouch, { passive: false });
      this._cleanup = () => {
        mazeCanvas.removeEventListener('mousedown', onPointer);
        mazeCanvas.removeEventListener('mousemove', onMove);
        mazeCanvas.removeEventListener('touchstart', onTouch);
        mazeCanvas.removeEventListener('touchmove', onTouch);
        this._cleanup = null;
      };
    },
    unbind() {
      if (this._cleanup) {
        this._cleanup();
        this._cleanup = null;
      }
    },
  };

  const savedRun = loadRun(dailySeed);
  if (savedRun) {
    completedTrails = savedRun.trails;
    completedSplits = savedRun.splits;
    runTotalMs = savedRun.totalMs;
    btnStart.textContent = 'View Results';
  }

  btnStart.addEventListener('click', () => {
    if (loadRun(dailySeed)) {
      const saved = loadRun(dailySeed);
      mazes = dailyMazes;
      completedTrails = saved.trails;
      completedSplits = saved.splits;
      runTotalMs = saved.totalMs;
      buildResultsScreen();
      showScreen('results');
      return;
    }
    setupDailyGame();
    inputHandler.bind();
    pointerHandler.bind();
    lastMazeIndex = -1;
    runCountdown();
  });

  btnCopy.addEventListener('click', copyResult);
  btnHome.addEventListener('click', () => {
    if (loadRun(dailySeed)) btnStart.textContent = 'View Results';
    showScreen('landing');
  });

  btnPractice.addEventListener('click', () => {
    practiceActive = true;
    practiceMazeCount = 0;
    practiceSeedBase = Math.floor(Math.random() * 0x7FFFFFFF);
    splitsFooter.textContent = '';
    mazeLabel.textContent = 'Practice · Maze 1';
    timerEl.textContent = '0:00.00';
    btnExitPractice.classList.remove('hidden');
    launchPracticeMaze(false);
    inputHandler.bind();
    pointerHandler.bind();
    showScreen('gameplay');
    const ctx = mazeCanvas.getContext('2d');
    ctx.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
    game.startRun();
    startGameLoop();
  });

  btnExitPractice.addEventListener('click', () => {
    practiceActive = false;
    btnExitPractice.classList.add('hidden');
    game?.stop();
    inputHandler.unbind();
    stopGameLoop();
    pointerHandler.unbind();
    showScreen('landing');
  });

  recapExpandOverlay.addEventListener('click', (e) => {
    if (e.target === recapExpandOverlay || e.target.closest('.recap-expand-close')) hideRecapExpand();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !recapExpandOverlay.classList.contains('hidden')) hideRecapExpand();
  });
}

init();
