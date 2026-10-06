/* Tácticas del Rock — SFX: efectos de sonido sintetizados con WebAudio (sin archivos).
 * Solo decoración: no toca la simulación. El audio arranca con el primer toque o tecla
 * (los navegadores no dejan sonar antes de una interacción).
 *   SFX.play('buy')   SFX.setVolume(0..1)   SFX.setMuted(bool)
 */
'use strict';
const SFX = (() => {
  let ctx = null, master = null, comp = null, vol = 0.5, muted = false, distCurve = null;
  const last = {};
  // separación mínima entre dos sonidos iguales (ms): evita que el combate sea un ruido blanco
  const GAP = { hit: 55, crit: 90, cast: 90, death: 120, heal: 200, place: 60, tick: 400, miss: 120 };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
      master = ctx.createGain(); master.gain.value = muted ? 0 : vol;
      master.connect(comp); comp.connect(ctx.destination);
      distCurve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; distCurve[i] = Math.tanh(x * 6); }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const unlock = () => ensure();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  // ---------- bloques ----------
  function env(g, t0, a, peak, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
  function tone(freq, dur, o = {}) {
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
    env(g, t0, o.attack || 0.005, o.gain || 0.3, dur);
    let node = osc;
    if (o.dist) { const ws = ctx.createWaveShaper(); ws.curve = distCurve; node.connect(ws); node = ws; }
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + (o.attack || 0.005) + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, o = {}) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1200, t0); f.Q.value = o.q || 1;
    if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t0 + dur);
    env(g, t0, o.attack || 0.005, o.gain || 0.3, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random()); src.stop(t0 + (o.attack || 0.005) + dur + 0.05);
  }
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // nota MIDI -> Hz
  function powerChord(root, dur = 0.7, gain = 0.16, delay = 0) { // quinta + octava, con distorsión
    for (const k of [0, 7, 12]) tone(N(root + k), dur, { type: 'sawtooth', gain, dist: true, lp: 2600, delay, attack: 0.01 });
  }
  function crowd(dur = 1.4, gain = 0.18, delay = 0) { // gente gritando: ruido filtrado con varias capas
    noise(dur, { freq: 900, q: 0.6, gain, attack: 0.25, delay });
    noise(dur * 0.8, { freq: 2200, q: 1.5, gain: gain * 0.5, attack: 0.15, delay: delay + 0.1 });
  }

  // ---------- catálogo ----------
  const S = {
    buy:     () => { tone(N(76), 0.18, { type: 'triangle', gain: 0.25 }); tone(N(83), 0.22, { type: 'triangle', gain: 0.2, delay: 0.06 }); },
    sell:    () => { tone(N(88), 0.1, { type: 'square', gain: 0.12 }); tone(N(93), 0.25, { type: 'square', gain: 0.12, delay: 0.08 }); },
    reroll:  () => { noise(0.22, { freq: 500, sweepTo: 4000, q: 2, gain: 0.25 }); for (let i = 0; i < 3; i++) tone(N(72 + i * 4), 0.05, { type: 'square', gain: 0.06, delay: 0.05 + i * 0.05 }); },
    xp:      () => { tone(N(67), 0.12, { type: 'triangle', gain: 0.2 }); tone(N(74), 0.16, { type: 'triangle', gain: 0.2, delay: 0.08 }); },
    levelup: () => { [60, 64, 67, 72].forEach((n, i) => tone(N(n), 0.25, { type: 'sawtooth', gain: 0.1, lp: 3000, delay: i * 0.08 })); powerChord(48, 0.8, 0.1, 0.32); },
    place:   () => tone(140, 0.12, { type: 'sine', slideTo: 60, gain: 0.35 }),
    click:   () => tone(N(84), 0.04, { type: 'square', gain: 0.07 }),
    error:   () => { tone(110, 0.12, { type: 'square', gain: 0.15, lp: 900 }); tone(98, 0.16, { type: 'square', gain: 0.15, lp: 900, delay: 0.13 }); },
    ready:   () => { tone(150, 0.15, { slideTo: 45, gain: 0.5 }); noise(0.12, { filter: 'highpass', freq: 1500, gain: 0.25, delay: 0.18 }); },
    tick:    () => tone(N(96), 0.03, { type: 'square', gain: 0.06 }),
    equip:   () => { tone(2000, 0.08, { type: 'triangle', gain: 0.12 }); tone(2600, 0.1, { type: 'triangle', gain: 0.1, delay: 0.05 }); },
    fusion:  () => [84, 88, 91, 96].forEach((n, i) => tone(N(n), 0.18, { type: 'triangle', gain: 0.12, delay: i * 0.05 })),
    pick:    () => { tone(N(79), 0.2, { type: 'triangle', gain: 0.2 }); tone(N(86), 0.3, { type: 'triangle', gain: 0.16, delay: 0.1 }); },
    combine: star => { powerChord(star >= 3 ? 52 : 47, 0.9, 0.13); [84, 88, 91, 96, 100].forEach((n, i) => tone(N(n), 0.25, { type: 'sine', gain: 0.1, delay: 0.15 + i * 0.06 })); if (star >= 3) crowd(1.6, 0.15, 0.2); },
    trait:   tier => { powerChord(40 + tier * 5, 0.75, 0.13); },          // sube un umbral: power chord (más agudo cuanto más alto)
    unique:  () => { powerChord(45, 1, 0.13); crowd(1.3, 0.14, 0.15); },
    traitDown: () => tone(N(52), 0.25, { type: 'triangle', gain: 0.15, slideTo: N(47) }),
    // combate
    hit:     () => { noise(0.05, { freq: 900 + Math.random() * 900, q: 1.2, gain: 0.12 }); },
    crit:    () => { noise(0.1, { filter: 'highpass', freq: 1800, gain: 0.22 }); tone(220, 0.08, { type: 'square', gain: 0.08, lp: 1200 }); },
    cast:    () => { noise(0.3, { freq: 400, sweepTo: 3500, q: 3, gain: 0.16 }); tone(N(76 + Math.floor(Math.random() * 5)), 0.3, { type: 'triangle', gain: 0.1, delay: 0.05 }); },
    death:   () => tone(300, 0.4, { type: 'triangle', slideTo: 70, gain: 0.2 }),
    miss:    () => noise(0.08, { freq: 3000, q: 4, gain: 0.08 }),
    heal:    () => tone(N(84), 0.2, { type: 'sine', gain: 0.08 }),
    revive:  () => [60, 67, 72, 79].forEach((n, i) => tone(N(n), 0.25, { type: 'sawtooth', gain: 0.08, lp: 2500, delay: i * 0.07 })),
    glitch:  () => { for (let i = 0; i < 5; i++) tone(200 + Math.random() * 1800, 0.04, { type: 'square', gain: 0.08, delay: i * 0.04 }); },
    overtime:() => { tone(300, 1.1, { type: 'sawtooth', slideTo: 900, gain: 0.08, lp: 2000 }); tone(N(60), 0.12, { type: 'square', gain: 0.1, delay: 1.0 }); },
    win:     () => { powerChord(45, 1.1, 0.15); powerChord(52, 1.2, 0.13, 0.35); crowd(1.8, 0.2, 0.2); },
    lose:    () => [64, 62, 59, 55].forEach((n, i) => tone(N(n), 0.35, { type: 'triangle', gain: 0.14, delay: i * 0.18 })),
    carousel:() => [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.2, { type: 'triangle', gain: 0.12, delay: i * 0.07 })),
  };

  function play(name, arg) {
    if (muted || !S[name]) return;
    if (!ensure() || ctx.state !== 'running') return;
    const now = performance.now();
    if (GAP[name] && now - (last[name] || 0) < GAP[name]) return;
    last[name] = now;
    try { S[name](arg); } catch (e) { /* nunca romper el juego por un sonido */ }
  }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = muted ? 0 : vol; }
  function setMuted(m) { muted = !!m; if (master) master.gain.value = muted ? 0 : vol; }
  return { play, setVolume, setMuted, get muted() { return muted; }, get volume() { return vol; } };
})();
