/* ---------- sound (synthesised, starts on first interaction) ---------- */
let ac = null, muted = false;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } return ac; }
function noiseBuf(a, len) { const b = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function sfx(kind, mass = 1) {
  if (muted) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime, g = a.createGain(); g.connect(a.destination);
  if (kind === 'thunk') {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150 - mass * 14, t); o.frequency.exponentialRampToValueAtTime(55, t + .16);
    g.gain.setValueAtTime(.32, t); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(g); o.start(t); o.stop(t + .25);
    const n = a.createBufferSource(); n.buffer = noiseBuf(a, .08); const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g2 = a.createGain(); g2.gain.setValueAtTime(.14, t); g2.gain.exponentialRampToValueAtTime(.001, t + .08); n.connect(f); f.connect(g2); g2.connect(a.destination); n.start(t);
  } else if (kind === 'splash' || kind === 'slide') {
    const n = a.createBufferSource(); n.buffer = noiseBuf(a, .6); const f = a.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(kind === 'slide' ? 500 : 1400, t); f.frequency.exponentialRampToValueAtTime(kind === 'slide' ? 260 : 380, t + .5);
    g.gain.setValueAtTime(kind === 'slide' ? .12 : .3, t); g.gain.exponentialRampToValueAtTime(.001, t + .55); n.connect(f); f.connect(g); n.start(t);
  } else if (kind === 'horn') {
    for (const fr of [110, 165]) { const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520; o.connect(f); f.connect(g); o.start(t); o.stop(t + 1.1); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.09, t + .08); g.gain.setValueAtTime(.09, t + .85); g.gain.linearRampToValueAtTime(0, t + 1.1);
  } else if (kind === 'coin') {
    const o = a.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(1320, t + .08);
    g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .3); o.connect(g); o.start(t); o.stop(t + .3);
  }
}
