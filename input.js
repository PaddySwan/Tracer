/**
 * Tracer — Keyboard: first tap = one cell; hold (after delay) = fast repeat.
 * Keeps turns precise while allowing fast movement in corridors.
 */

const KEY_TO_DIR = {
  ArrowUp: 'n',
  ArrowDown: 's',
  ArrowLeft: 'w',
  ArrowRight: 'e',
  KeyW: 'n',
  KeyS: 's',
  KeyA: 'w',
  KeyD: 'e',
};

const INITIAL_DELAY_MS = 120; // hold this long before repeat starts
const REPEAT_MS = 28;         // then one move per this interval (faster = less laggy feel)

/**
 * First keypress always moves once. If key is held, after INITIAL_DELAY_MS
 * we start repeating every REPEAT_MS. Changing direction = one move then new delay.
 */
function createInputHandler(onMove) {
  let currentDir = null;
  let holdTimeoutId = null;
  let repeatIntervalId = null;

  function clearTimers() {
    if (holdTimeoutId) {
      clearTimeout(holdTimeoutId);
      holdTimeoutId = null;
    }
    if (repeatIntervalId) {
      clearInterval(repeatIntervalId);
      repeatIntervalId = null;
    }
  }

  function keyDown(e) {
    const dir = KEY_TO_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat) return;

    clearTimers();
    currentDir = dir;
    onMove(dir);

    holdTimeoutId = setTimeout(() => {
      holdTimeoutId = null;
      if (currentDir !== dir) return;
      repeatIntervalId = setInterval(() => {
        if (currentDir !== dir) return;
        onMove(dir);
      }, REPEAT_MS);
    }, INITIAL_DELAY_MS);
  }

  function keyUp(e) {
    const dir = KEY_TO_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    if (currentDir === dir) {
      currentDir = null;
      clearTimers();
    }
  }

  function bind() {
    currentDir = null;
    clearTimers();
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
  }

  function unbind() {
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    currentDir = null;
    clearTimers();
  }

  function tick() {}
  function reset() {
    currentDir = null;
    clearTimers();
  }

  return { bind, unbind, tick, reset };
}

export { createInputHandler, KEY_TO_DIR };
