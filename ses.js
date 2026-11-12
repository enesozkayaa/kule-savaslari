// =============================================================
// Kule Savaşları - ses efektleri (dosya yok, tarayıcı kendisi üretir)
// Sadece oyun seslerini açar/kapatır; sesli sohbet ayrı.
// =============================================================

const Ses = (() => {
  let ctx = null, acik = true, sonCarp = 0;
  try { acik = localStorage.getItem('ks.ses') !== '0'; } catch (e) { }
  const al = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function ton(frek, sure, tip = 'sine', ses = 0.15, gecikme = 0, kayma = 0) {
    const c = al(); if (!c || !acik) return;
    const t = c.currentTime + gecikme;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tip; o.frequency.setValueAtTime(frek, t);
    if (kayma) o.frequency.exponentialRampToValueAtTime(Math.max(30, frek + kayma), t + sure);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(ses, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + sure + 0.02);
  }
  function gurultu(sure, ses = 0.5, filtre = 1200, tip = 'lowpass', gecikme = 0) {
    const c = al(); if (!c || !acik) return;
    const n = Math.floor(c.sampleRate * sure), buf = c.createBuffer(1, n, c.sampleRate), v = buf.getChannelData(0);
    for (let i = 0; i < n; i++) v[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = tip; f.frequency.value = filtre; g.gain.value = ses;
    s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + gecikme);
  }
  // Rüzgâr: yükselip alçalan uğultu
  function ruzgar(sure = 4) {
    const c = al(); if (!c || !acik) return;
    const n = Math.floor(c.sampleRate * sure), buf = c.createBuffer(1, n, c.sampleRate), v = buf.getChannelData(0);
    for (let i = 0; i < n; i++) v[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    s.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + sure * 0.4); f.frequency.linearRampToValueAtTime(400, t + sure);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.4); g.gain.setValueAtTime(0.35, t + sure - 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  return {
    ac: al,
    acikMi: () => acik,
    ayarla: a => { acik = a; try { localStorage.setItem('ks.ses', a ? '1' : '0'); } catch (e) { } },
    oynat: () => ton(520, 0.04, 'square', 0.035),
    dondur: () => { ton(700, 0.07, 'triangle', 0.08, 0, 300); },
    takildi: (() => { let son = 0; return () => { const s = performance.now(); if (s - son < 250) return; son = s; ton(160, 0.08, 'square', 0.05); }; })(),
    koy: () => { gurultu(0.12, 0.45, 500); ton(110, 0.15, 'sine', 0.25, 0, -40); },
    carp: v => { const s = performance.now(); if (s - sonCarp < 70) return; sonCarp = s; const k = Math.min(1, v / 8); gurultu(0.08, 0.15 + k * 0.35, 380 + k * 500); ton(90 + Math.random() * 40, 0.1, 'sine', 0.08 + k * 0.15); },
    dustu: () => { ton(900, 0.7, 'sine', 0.12, 0, -760); gurultu(0.5, 0.6, 700, 'lowpass', 0.6); ton(70, 0.4, 'sine', 0.3, 0.6, -30); },
    aletGeldi: () => [880, 1175, 1568].forEach((f, i) => ton(f, 0.14, 'triangle', 0.1, i * 0.07)),
    aletKullan: () => { ton(400, 0.3, 'sawtooth', 0.08, 0, 900); gurultu(0.25, 0.2, 3000, 'highpass'); },
    buz: () => [2100, 2600, 3100, 2400].forEach((f, i) => ton(f, 0.18, 'sine', 0.06, i * 0.05)),
    dev: () => { ton(80, 0.5, 'square', 0.12, 0, -30); ton(60, 0.6, 'sine', 0.2, 0.05); },
    hiz: () => ton(300, 0.35, 'sawtooth', 0.08, 0, 1200),
    zimba: () => [0, 0.09, 0.18].forEach(g => { gurultu(0.05, 0.6, 4000, 'highpass', g); ton(1500, 0.05, 'square', 0.06, g); }),
    ruzgar,
    lazer: () => ton(220, 0.5, 'sawtooth', 0.12, 0, 60),
    sayac: son => ton(son ? 1046 : 660, son ? 0.35 : 0.15, 'square', 0.1),
    zafer: () => [523, 659, 784, 1047, 1319].forEach((f, i) => ton(f, 0.28, 'triangle', 0.15, i * 0.11)),
    kaybet: () => [392, 330, 262, 196].forEach((f, i) => ton(f, 0.3, 'triangle', 0.13, i * 0.16)),
    bildirim: () => ton(880, 0.12, 'sine', 0.1),
    sarmasik: () => { gurultu(0.35, 0.3, 2500, 'bandpass'); [520, 660, 780].forEach((f, i) => ton(f, 0.12, 'triangle', 0.07, 0.1 + i * 0.06)); },
  };
})();
