/**
 * Tracer — Synthesized sound effects via Web Audio API.
 * Sound is off by default; mute state persists in localStorage.
 */

const STORAGE_KEY = 'tracer-sound';
const GROAN_KEY = 'tracer-groan';
const VOLUME_KEY = 'tracer-volume';
let _ctx = null;
let _muted = localStorage.getItem(STORAGE_KEY) !== 'on';
let _volume = parseFloat(localStorage.getItem(VOLUME_KEY) ?? '0.5');
let _groanMode = localStorage.getItem(GROAN_KEY) === 'on';
let _groanBuffer = null;

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

function getVolume() { return _volume; }
function setVolume(val) {
  _volume = Math.max(0, Math.min(1, val));
  localStorage.setItem(VOLUME_KEY, String(_volume));
}

function isGroanMode() { return _groanMode; }
function setGroanMode(val) {
  _groanMode = val;
  localStorage.setItem(GROAN_KEY, val ? 'on' : 'off');
}

async function _loadGroan() {
  if (_groanBuffer) return _groanBuffer;
  const ctx = _getCtx();
  const res = await fetch('./assets/audio/groan.wav');
  const arr = await res.arrayBuffer();
  _groanBuffer = await ctx.decodeAudioData(arr);
  return _groanBuffer;
}

function _playGroanRamp(startRate, endRate) {
  _loadGroan().then(buffer => {
    const ctx = _getCtx();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(startRate, ctx.currentTime);
    source.playbackRate.linearRampToValueAtTime(endRate, ctx.currentTime + 0.7);
    gain.gain.setValueAtTime(0.6 * _volume * 3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.9);
  });
}

function playGroanUnlock()  { _playGroanRamp(0.4, 2.2); }
function playGroanDisable() { _playGroanRamp(2.2, 0.4); }

function playGroanMove(proximity = 0) {
  if (_muted) return;
  _loadGroan().then(buffer => {
    const ctx = _getCtx();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    // Mirror the normal audio curve: ~1.5 octaves rise as proximity goes 0 → 1
    source.playbackRate.value = 0.5 * Math.pow(4, proximity * 0.75);
    gain.gain.setValueAtTime(0.45 * _volume * 3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + 0.45);
  });
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
  gain.gain.setValueAtTime(gainVal * _volume * 3, t);
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

export { isMuted, setMuted, getVolume, setVolume, playMove, playMazeClear, playRunComplete, isGroanMode, setGroanMode, playGroanUnlock, playGroanDisable, playGroanMove };
