/**
 * Tracer — App entry: screens, countdown, game loop, recap.
 */

import { getDailySeed, generateDailyMazes, generateMaze, mulberry32, getHoliday, MAZE_SIZES, TRAIL_COLORS, TRAIL_EMOJIS } from './maze.js?v=53';
import { getCanvasSize, renderMaze, renderRecapPanel, renderGlyph, renderBlindMaze, renderDarkMaze } from './render.js?v=53';
import { createInputHandler } from './input.js?v=53';
import { createGame, formatTime } from './game.js?v=53';
import { saveRun, loadRun } from './storage.js?v=53';
import { isMuted, setMuted, getVolume, setVolume, playMove, playMazeClear, playRunComplete, isGroanMode, setGroanMode, playGroanUnlock, playGroanDisable, playGroanMove } from './sound.js?v=53';
const REVISION = 53;
const LATEST_CHANGE = 'Latest update: Settings panel added — adjust volume, toggle sound, and try experimental practice modes: Blind Mode (navigate by sound alone) and Dark Mode (limited flashlight vision).';

// Experimental mode state (practice only)
let _blindMode = localStorage.getItem('tracer-blind') === 'on';
let _darkMode  = localStorage.getItem('tracer-dark')  === 'on';
function isBlindMode() { return _blindMode; }
function isDarkMode()  { return _darkMode; }
function setBlindMode(val) {
  _blindMode = val;
  if (val) { _darkMode = false; localStorage.setItem('tracer-dark', 'off'); }
  localStorage.setItem('tracer-blind', val ? 'on' : 'off');
}
function setDarkMode(val) {
  _darkMode = val;
  if (val) { _blindMode = false; localStorage.setItem('tracer-blind', 'off'); }
  localStorage.setItem('tracer-dark', val ? 'on' : 'off');
}

const ICON_SETTINGS = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const ICON_SOUND    = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const ICON_MUTE     = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
const ICON_HISTORY  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

// History color scale: green (fast) → red (slow)
const TIME_THRESHOLDS = [45000, 75000, 105000, 150000]; // ms
const TIME_COLORS     = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

function getTimeColor(ms) {
  for (let i = 0; i < TIME_THRESHOLDS.length; i++) {
    if (ms <= TIME_THRESHOLDS[i]) return TIME_COLORS[i];
  }
  return TIME_COLORS[4];
}
const DAY_NUM = Math.floor((Date.now() - new Date('2026-01-01T00:00:00Z')) / 86400000) + 1;
const HOLIDAY = getHoliday(new Date());
const activeColors = HOLIDAY ? HOLIDAY.trailColors : TRAIL_COLORS;
const activeEmojis = HOLIDAY ? HOLIDAY.trailEmojis : TRAIL_EMOJIS;
const activeWallColor = HOLIDAY?.wallColor ?? undefined; // undefined = render.js default

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
const btnCopy = document.getElementById('btn-copy');
const btnShare = document.getElementById('btn-share');
const btnHome = document.getElementById('btn-home');
const btnPractice = document.getElementById('btn-practice');
const btnExitPractice = document.getElementById('btn-exit-practice');
const btnMute = document.getElementById('btn-mute');
const revisionEl = document.getElementById('revision');
const recapExpandOverlay = document.getElementById('recap-expand-overlay');
const recapExpandCanvas = document.getElementById('recap-expand-canvas');
const recapExpandTitle = document.getElementById('recap-expand-title');
const recapExpandSplit = document.getElementById('recap-expand-split');
const btnHistory = document.getElementById('btn-history');
const historyOverlay = document.getElementById('history-overlay');
const btnSettings = document.getElementById('btn-settings');
const settingsOverlay = document.getElementById('settings-overlay');
const historyTitleEl = document.getElementById('history-title');
const historyGridEl = document.getElementById('history-grid');

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
  const colorIndex = practiceActive ? practiceMazeCount % activeColors.length : state.mazeIndex;
  const color = activeColors[colorIndex];
  if (practiceActive && isBlindMode()) {
    const [sx, sy] = state.maze.start;
    const atStart = Math.hypot(playerVisualPos[0] - (sx + 0.5), playerVisualPos[1] - (sy + 0.5)) < 0.15;
    renderBlindMaze(ctx, state.maze, state.trail, [...playerVisualPos], color, cellPx, atStart);
  } else if (practiceActive && isDarkMode()) {
    renderDarkMaze(ctx, state.maze, state.trail, [...playerVisualPos], color, cellPx, activeWallColor);
  } else {
    renderMaze(ctx, state.maze, state.trail, [...playerVisualPos], color, cellPx, activeWallColor);
  }
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
  const panelSize = 80;
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
    renderRecapPanel(ctx, maze, trail, activeColors[i], panelSize, activeWallColor);
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

  const glyphCanvas = document.getElementById('glyph-canvas');
  const glyphSize = 160;
  glyphCanvas.width = glyphSize;
  glyphCanvas.height = glyphSize;
  renderGlyph(glyphCanvas.getContext('2d'), mazes, completedTrails, activeColors, glyphSize);
}

function showRecapExpand(index) {
  const maze = mazes[index];
  const trail = completedTrails[index] || [];
  const color = activeColors[index];
  const sizePx = Math.min(420, window.innerWidth - 48, window.innerHeight - 120);
  const cellPx = sizePx / maze.size;
  const w = maze.size * cellPx;
  const h = w;
  recapExpandCanvas.width = w;
  recapExpandCanvas.height = h;
  const ctx = recapExpandCanvas.getContext('2d');
  renderRecapPanel(ctx, maze, trail, color, sizePx, activeWallColor);
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
  const lines = [
    `Tracer #${DAY_NUM}`,
    '',
    ...completedSplits.map((ms, i) => `${activeEmojis[i]} Maze ${i + 1}: ${formatTime(ms)}`),
    '',
    `Total: ${formatTime(runTotalMs)}`,
  ];
  const text = lines.join('\n');

  function onSuccess() {
    const label = btnCopy.textContent;
    btnCopy.textContent = 'Copied!';
    btnCopy.disabled = true;
    setTimeout(() => {
      btnCopy.textContent = label;
      btnCopy.disabled = false;
    }, 2000);
  }

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => execCommandCopy(text, onSuccess));
  } else {
    execCommandCopy(text, onSuccess);
  }
}

function execCommandCopy(text, onSuccess) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { if (document.execCommand('copy')) onSuccess(); } catch (_) {}
  document.body.removeChild(ta);
}

async function shareImage() {
  await document.fonts.ready;

  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, W, H);

  // Logo
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F5F5F5';
  ctx.font = '72px Pacifico';
  ctx.fillText('Tracer', W / 2, 110);

  // Day number
  ctx.fillStyle = '#B8B8B8';
  ctx.font = '500 32px Inter';
  ctx.fillText(`#${DAY_NUM}`, W / 2, 162);

  // Glyph — centered in the middle of the canvas
  const glyphSize = 680;
  const glyphX = (W - glyphSize) / 2;
  const glyphY = 200;
  const gc = document.createElement('canvas');
  gc.width = glyphSize;
  gc.height = glyphSize;
  renderGlyph(gc.getContext('2d'), mazes, completedTrails, activeColors, glyphSize);
  ctx.drawImage(gc, glyphX, glyphY);

  // Total time
  ctx.fillStyle = '#F5F5F5';
  ctx.font = '600 40px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(`Total  ${formatTime(runTotalMs)}`, W / 2, glyphY + glyphSize + 64);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const canCopyImage = navigator.clipboard?.write && typeof ClipboardItem !== 'undefined';

  function flashBtn(label) {
    btnShare.textContent = label;
    btnShare.disabled = true;
    setTimeout(() => {
      btnShare.textContent = 'Copy Glyph';
      btnShare.disabled = false;
    }, 2000);
  }

  if (canCopyImage) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flashBtn('Copied!');
      return;
    } catch (_) {}
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tracer-${DAY_NUM}.png`;
  a.click();
  URL.revokeObjectURL(url);
  flashBtn('Saved!');
}

function launchPracticeMaze(autoStart = false) {
  game?.stop();
  const size = MAZE_SIZES[practiceMazeCount % MAZE_SIZES.length];
  const rng = mulberry32(practiceSeedBase + practiceMazeCount * 1337);
  mazes = [generateMaze(size, rng)];
  if (isDarkMode()) {
    const maze = mazes[0];
    maze.start = [Math.floor(Math.random() * size), Math.floor(Math.random() * size)];
    let ex, ey;
    do {
      ex = Math.floor(Math.random() * size);
      ey = Math.floor(Math.random() * size);
    } while (Math.abs(ex - maze.start[0]) + Math.abs(ey - maze.start[1]) < size);
    maze.end = [ex, ey];
  }
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
      playMazeClear();
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

function openHistory() {
  const year = new Date().getFullYear();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const jan1 = new Date(year, 0, 1);
  const startOffset = (jan1.getDay() + 6) % 7; // Mon=0 … Sun=6
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeap ? 366 : 365;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const CELL = 11; const GAP = 2; // px

  // Read only totalMs from existing run keys — no extra storage needed
  const totalMsByDay = {};
  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(year, 0, 1 + i);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    try {
      const raw = localStorage.getItem(`tracer_run_${year}-${mm}-${dd}`);
      if (raw) totalMsByDay[i] = JSON.parse(raw).totalMs;
    } catch (_) {}
  }

  const totalWeeks = Math.ceil((startOffset + daysInYear) / 7);
  const gridPx = totalWeeks * CELL + (totalWeeks - 1) * GAP;

  // Which week index does each month start in?
  const monthAtWeek = {};
  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(year, 0, 1 + i);
    if (d.getDate() === 1) monthAtWeek[Math.floor((startOffset + i) / 7)] = MONTHS[d.getMonth()];
  }

  historyTitleEl.textContent = String(year);
  historyGridEl.innerHTML = '';

  // Wrapper with known pixel width — gives scroll container an exact size to work with
  const wrapper = document.createElement('div');
  wrapper.className = 'history-inner';
  wrapper.style.width = gridPx + 'px';

  // Month labels — absolutely positioned at their exact week column offset
  for (const [weekIdx, name] of Object.entries(monthAtWeek)) {
    const label = document.createElement('span');
    label.className = 'history-month-label';
    label.textContent = name;
    label.style.left = (Number(weekIdx) * (CELL + GAP)) + 'px';
    wrapper.appendChild(label);
  }

  // Week columns
  const weeksEl = document.createElement('div');
  weeksEl.className = 'history-weeks';
  for (let w = 0; w < totalWeeks; w++) {
    const weekEl = document.createElement('div');
    weekEl.className = 'history-week';
    for (let d = 0; d < 7; d++) {
      const dayIdx = w * 7 + d - startOffset;
      const cell = document.createElement('div');
      cell.className = 'history-cell';
      if (dayIdx < 0 || dayIdx >= daysInYear) {
        cell.classList.add('hc-empty');
      } else {
        const date = new Date(year, 0, 1 + dayIdx);
        if (date.getTime() === todayStart.getTime()) cell.classList.add('hc-today');
        if (totalMsByDay[dayIdx] != null) {
          cell.style.background = getTimeColor(totalMsByDay[dayIdx]);
          const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          cell.title = `${label} — ${formatTime(totalMsByDay[dayIdx])}`;
        }
        // unplayed (past or future) keeps default dark .history-cell style
      }
      weekEl.appendChild(cell);
    }
    weeksEl.appendChild(weekEl);
  }
  wrapper.appendChild(weeksEl);
  historyGridEl.appendChild(wrapper);

  historyOverlay.classList.remove('hidden');
  historyOverlay.setAttribute('aria-hidden', 'false');
}

function closeHistory() {
  historyOverlay.classList.add('hidden');
  historyOverlay.setAttribute('aria-hidden', 'true');
}

function updateSettingsUI() {
  const muteToggle = document.getElementById('settings-mute-toggle');
  muteToggle.textContent = isMuted() ? 'Off' : 'On';
  muteToggle.classList.toggle('on', !isMuted());

  const blindToggle = document.getElementById('settings-blind-toggle');
  blindToggle.textContent = isBlindMode() ? 'On' : 'Off';
  blindToggle.classList.toggle('on', isBlindMode());

  const darkToggle = document.getElementById('settings-dark-toggle');
  darkToggle.textContent = isDarkMode() ? 'On' : 'Off';
  darkToggle.classList.toggle('on', isDarkMode());

  document.getElementById('settings-volume').value = getVolume();
}

function openSettings() {
  updateSettingsUI();
  settingsOverlay.classList.remove('hidden');
  settingsOverlay.setAttribute('aria-hidden', 'false');
}

function closeSettings() {
  settingsOverlay.classList.add('hidden');
  settingsOverlay.setAttribute('aria-hidden', 'true');
}

function buildRolloverHint() {
  const now = new Date();
  const nextMidnightUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const zones = [
    { label: 'PT',  tz: 'America/Los_Angeles' },
    { label: 'ET',  tz: 'America/New_York' },
    { label: 'CET', tz: 'Europe/Paris' },
    { label: 'JST', tz: 'Asia/Tokyo' },
  ];
  const fmt = (tz) => new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  }).format(nextMidnightUTC).toLowerCase().replace(':00', '');
  const times = zones.map(({ label, tz }) => `${label} ${fmt(tz)}`);
  return `Resets midnight UTC\n${times.slice(0, 2).join(' · ')}\n${times.slice(2).join(' · ')}`;
}

const SECRET_CODE = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
let secretBuffer = [];

function updateGroanBanner() {
  const banner = document.getElementById('groan-banner');
  if (isGroanMode()) {
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

function init() {
  revisionEl.textContent = `Revision ${REVISION}`;
  revisionEl.dataset.tooltip = LATEST_CHANGE;
  document.getElementById('rollover-hint').textContent = buildRolloverHint();

  updateGroanBanner();
  document.getElementById('btn-groan-off').addEventListener('click', () => {
    setGroanMode(false);
    updateGroanBanner();
    playGroanDisable();
  });

  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('landing').classList.contains('active')) return;
    secretBuffer.push(e.key);
    if (secretBuffer.length > SECRET_CODE.length) secretBuffer.shift();
    if (secretBuffer.join(',') === SECRET_CODE.join(',')) {
      secretBuffer = [];
      setGroanMode(true);
      updateGroanBanner();
      playGroanUnlock();
    }
  });
  btnHistory.innerHTML = ICON_HISTORY;
  btnHistory.addEventListener('click', openHistory);
  historyOverlay.addEventListener('click', (e) => {
    if (e.target === historyOverlay || e.target.closest('.recap-expand-close')) closeHistory();
  });

  btnSettings.innerHTML = ICON_SETTINGS;
  btnSettings.addEventListener('click', openSettings);
  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay || e.target.closest('.recap-expand-close')) closeSettings();
  });
  document.getElementById('settings-mute-toggle').addEventListener('click', () => {
    setMuted(!isMuted());
    btnMute.innerHTML = isMuted() ? ICON_MUTE : ICON_SOUND;
    updateSettingsUI();
  });
  document.getElementById('settings-blind-toggle').addEventListener('click', () => {
    setBlindMode(!isBlindMode());
    updateSettingsUI();
  });
  document.getElementById('settings-dark-toggle').addEventListener('click', () => {
    setDarkMode(!isDarkMode());
    updateSettingsUI();
  });
  document.getElementById('settings-volume').addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
  });

  btnMute.innerHTML = isMuted() ? ICON_MUTE : ICON_SOUND;
  btnMute.addEventListener('click', () => {
    setMuted(!isMuted());
    btnMute.innerHTML = isMuted() ? ICON_MUTE : ICON_SOUND;
  });
  document.getElementById('day-number').textContent = `Tracer #${DAY_NUM}`;
  document.getElementById('results-day-number').textContent = `Tracer #${DAY_NUM}`;
  if (HOLIDAY) {
    document.documentElement.style.setProperty('--holiday-color', HOLIDAY.accentColor);
    document.getElementById('landing-greeting').textContent = HOLIDAY.greeting;
    document.getElementById('landing-greeting').classList.remove('hidden');
    document.getElementById('results-greeting').textContent = HOLIDAY.greeting;
    document.getElementById('results-greeting').classList.remove('hidden');
  }
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
        playMazeClear();
      },
      onRunComplete(splits, totalMs) {
        playRunComplete();
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

  function getMoveProximity() {
    const s = game.getState();
    if (!s.maze) return 0;
    const [px, py] = s.playerPos;
    const [ex, ey] = s.maze.end;
    const dist = Math.abs(px - ex) + Math.abs(py - ey);
    return 1 - dist / ((s.maze.size - 1) * 2);
  }

  inputHandler = createInputHandler((dir) => {
    if (countdownActive) return;
    if (game.tryMove(dir)) isGroanMode() ? playGroanMove(getMoveProximity()) : playMove(getMoveProximity());
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
          isGroanMode() ? playGroanMove(getMoveProximity()) : playMove(getMoveProximity());
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
  btnShare.addEventListener('click', shareImage);
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
    if (e.key === 'Escape') {
      if (!recapExpandOverlay.classList.contains('hidden')) hideRecapExpand();
      if (!historyOverlay.classList.contains('hidden')) closeHistory();
    }
  });
}

init();
