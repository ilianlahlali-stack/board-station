/* Petits effets sonores synthétisés (aucun fichier audio). */
const Sfx = (() => {
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem('bs-sound') !== 'off'; } catch (e) { /* stockage indisponible */ }

  function ac() {
    if (!enabled) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function noise(dur, { freq = 2000, q = 1, gain = 0.2, type = 'bandpass', sweep = 0, delay = 0 } = {}) {
    const c = ac(); if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    const t = c.currentTime + delay;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t); src.stop(t + dur);
  }

  function tone(freq, dur, { type = 'sine', gain = 0.12, delay = 0 } = {}) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem('bs-sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
      return enabled;
    },
    dice(count = 3) {
      for (let i = 0; i < count * 4; i++) {
        noise(0.05, { freq: 1800 + Math.random() * 2500, q: 2, gain: 0.25 * (1 - i / (count * 5)), delay: 0.1 + i * 0.07 + Math.random() * 0.05 });
      }
    },
    card(delay = 0) { noise(0.13, { freq: 3500, q: 0.7, gain: 0.12, sweep: -2500, delay }); },
    chip(delay = 0) { tone(2400, 0.07, { type: 'triangle', gain: 0.08, delay }); tone(3600, 0.05, { type: 'triangle', gain: 0.05, delay: delay + 0.02 }); },
    click() { tone(600, 0.05, { type: 'triangle', gain: 0.06 }); },
    bad() { tone(180, 0.2, { type: 'sawtooth', gain: 0.06 }); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.1, delay: i * 0.11 })); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.09, delay: i * 0.16 })); },
  };
})();
