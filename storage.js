/**
 * Tracer — localStorage persistence for best time per day.
 */

const KEY_PREFIX = 'tracer_best_';

function getBestTimeKey(seed) {
  return KEY_PREFIX + seed;
}

function getBestTime(seed) {
  try {
    const raw = localStorage.getItem(getBestTimeKey(seed));
    if (raw == null) return null;
    const ms = parseInt(raw, 10);
    return isNaN(ms) ? null : ms;
  } catch (_) {
    return null;
  }
}

function setBestTime(seed, totalMs) {
  try {
    localStorage.setItem(getBestTimeKey(seed), String(totalMs));
  } catch (_) {}
}

export { getBestTime, setBestTime };
