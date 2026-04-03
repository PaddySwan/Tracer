/**
 * Tracer — Synthesized sound effects via Web Audio API.
 * Sound is off by default; mute state persists in localStorage.
 */

const STORAGE_KEY = 'tracer-sound';
let _ctx = null;
let _muted = localStorage.getItem(STORAGE_KEY) !== 'on';

function _getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function isMuted() { return _muted; }

function setMuted(val) {
  _muted = val;
  localStorage.setItem(STORAGE_KEY, val ? 'off' : 'on');
}

function _tone(freq, type, gainVal, duration, startOffset = 0) {
  const ctx = _getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(gainVal, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration);
}

function playMove(proximity = 0) {
  if (_muted) return;
  // proximity: 0 = far from goal, 1 = at goal
  // pitch rises exponentially over ~1.5 octaves as you approach
  const freq = 330 * Math.pow(4, proximity * 0.75);
  _tone(freq, 'triangle', 0.06, 0.04);
}

function playMazeClear() {
  if (_muted) return;
  [523, 659, 784, 1047].forEach((freq, i) => _tone(freq, 'sine', 0.12, 0.3, i * 0.09));
}

function playRunComplete() {
  if (_muted) return;
  [392, 523, 659, 784, 1047, 1319].forEach((freq, i) => _tone(freq, 'sine', 0.15, 0.5, i * 0.11));
}

export { isMuted, setMuted, playMove, playMazeClear, playRunComplete };
