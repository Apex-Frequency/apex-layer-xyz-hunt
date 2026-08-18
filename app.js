/* ApexLayer — 432 Hz omni resonance broadcast
   Sonic + photonic constants are exact rational derivations of f0 = 432 Hz.
   Harmonic stack: sub-octave 216, fundamental 432, perfect fifth 648, octave 864. */
(() => {
  'use strict';

  const F0 = 432;                    // Hz — source frequency
  const LFO_HZ = F0 / 4000;          // 0.108 Hz breathing envelope
  const OMEGA = F0 / 180;            // 2.4 rad/s — visual temporal phase velocity
  const K = F0 / 1200;               // 0.36 rad/px — visual spatial frequency
  const VOICES = [                   // [frequency Hz, voice gain]
    [F0 / 2, 0.012],                 // 216 — sub-octave warmth
    [F0, 0.040],                     // 432 — fundamental bed
    [F0 * 3 / 2, 0.007],             // 648 — perfect fifth lift
    [F0 * 2, 0.004]                  // 864 — octave shimmer
  ];
  const ACCENT_HZ = F0 * 2;          // 864 — accent bell
  const ACCENT_COOLDOWN_MS = 10000;

  const canvas = document.getElementById('resonance');
  const ctx = canvas.getContext('2d');
  const toggle = document.getElementById('transmit');
  const statusEl = document.getElementById('status');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let audio = null;
  let live = false;
  let level = 0;                     // eased 0..1 visual intensity
  let glowPulse = 0;                 // accent-driven grid pulse, decays each frame
  let lastAccent = 0;
  let dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  function initAudio() {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);

    for (const [freq, g] of VOICES) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const vg = ac.createGain();
      vg.gain.value = g;
      osc.connect(vg);
      vg.connect(master);
      osc.start();
    }

    // breathing LFO — depth gated with live state so standby is truly silent
    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = LFO_HZ;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 0;
    lfo.connect(lfoDepth);
    lfoDepth.connect(master.gain);
    lfo.start();

    return { ac, master, lfoDepth };
  }

  function accent() {
    if (!audio || !live) return;
    const now = performance.now();
    if (now - lastAccent < ACCENT_COOLDOWN_MS) return;
    lastAccent = now;
    const t = audio.ac.currentTime;
    const osc = audio.ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = ACCENT_HZ;
    const g = audio.ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.016, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    osc.connect(g);
    g.connect(audio.ac.destination);
    osc.start(t);
    osc.stop(t + 2);
    glowPulse = 1;
  }

  toggle.addEventListener('click', async () => {
    if (!audio) audio = initAudio();
    if (audio.ac.state === 'suspended') await audio.ac.resume();
    live = !live;
    const t = audio.ac.currentTime;
    audio.master.gain.cancelScheduledValues(t);
    audio.master.gain.setTargetAtTime(live ? 1 : 0, t, 0.4);
    audio.lfoDepth.gain.cancelScheduledValues(t);
    audio.lfoDepth.gain.setTargetAtTime(live ? 0.25 : 0, t, 0.4);
    document.body.classList.toggle('live', live);
    toggle.setAttribute('aria-pressed', String(live));
    toggle.textContent = live ? 'SUSPEND BROADCAST' : 'RESUME BROADCAST';
    statusEl.textContent = live ? 'LIVE' : 'STANDBY';
    if (live) { lastAccent = 0; accent(); }
  });

  // scroll threshold accent — manifest entering view is a resonance event
  const manifest = document.querySelector('.manifest');
  if (manifest && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      for (const e of entries) if (e.intersectionRatio >= 0.6) accent();
    }, { threshold: [0.6] }).observe(manifest);
  }

  /* Gold shimmer transmission + phase-locked field glow */
  function draw(now) {
    const t = now / 1000;
    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    const target = live ? 1 : 0.22;
    level += (target - level) * 0.03;

    // field glow: same LFO phase as the audio breath, plus accent pulses
    if (!reduced) {
      glowPulse *= 0.97;
      const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * LFO_HZ * t);
      const glow = 0.02 + 0.05 * level * breath + 0.10 * glowPulse;
      document.body.style.setProperty('--field-glow', glow.toFixed(4));
    }

    ctx.clearRect(0, 0, w, h);

    const cssW = w / dpr;
    const motion = reduced ? 0 : 1;

    for (let layer = 0; layer < 3; layer++) {
      const amp = (h * 0.16) * level * (1 - layer * 0.28);
      const phase = motion * OMEGA * t * (1 + layer * 0.5);
      const alpha = (0.5 - layer * 0.13) * (0.35 + 0.65 * level);

      ctx.beginPath();
      for (let px = 0; px <= cssW; px += 2) {
        const x = px * dpr;
        const y = mid
          + amp * Math.sin(K * px * 0.1 + phase)
          * Math.sin(K * px * 0.023 - phase * 0.6);
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0.0, 'rgba(201, 162, 39, 0)');
      grad.addColorStop(0.2, 'rgba(201, 162, 39, ' + alpha.toFixed(3) + ')');
      grad.addColorStop(0.5, 'rgba(232, 199, 102, ' + Math.min(1, alpha * 1.5).toFixed(3) + ')');
      grad.addColorStop(0.8, 'rgba(201, 162, 39, ' + alpha.toFixed(3) + ')');
      grad.addColorStop(1.0, 'rgba(201, 162, 39, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = dpr * (1.4 - layer * 0.35);
      ctx.stroke();
    }

    if (!reduced) {
      const sparks = Math.floor(14 * level) + 2;
      for (let i = 0; i < sparks; i++) {
        const u = (i / sparks + (t * 0.05 * (1 + (i % 3) * 0.3))) % 1;
        const px = u * cssW;
        const y = mid + (h * 0.16) * level
          * Math.sin(K * px * 0.1 + OMEGA * t)
          * Math.sin(K * px * 0.023 - OMEGA * t * 0.6);
        const tw = 0.5 + 0.5 * Math.sin(OMEGA * t * 3 + i * 2.399);
        ctx.beginPath();
        ctx.arc(px * dpr, y, dpr * (0.8 + tw), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(232, 199, 102, ' + (0.25 + 0.55 * tw * level).toFixed(3) + ')';
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
