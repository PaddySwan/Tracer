/**
 * Tracer — persist today's completed run (splits, totalMs, trails) in localStorage.
 */

function getRunKey(seed) {
  return 'tracer_run_' + seed;
}

function saveRun(seed, { splits, totalMs, trails }) {
  try {
    localStorage.setItem(getRunKey(seed), JSON.stringify({ splits, totalMs, trails }));
  } catch (_) {}
}

function loadRun(seed) {
  try {
    const raw = localStorage.getItem(getRunKey(seed));
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export { saveRun, loadRun };
