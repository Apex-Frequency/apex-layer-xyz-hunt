/* ApexLayer — 432 Hz omni resonance broadcast
   All constants are exact rational derivations of the source frequency. */
(() => {
  'use strict';

  const F0 = 432;              // Hz — source logos
  const LFO_HZ = F0 / 4000;    // 0.108 Hz breathing envelope
  const OMEGA = F0 / 180;      // 2.4 rad/s — visual temporal phase velocity
  const K = F0 / 1200;         // 0.36 rad/px — visual spatial frequency
  const GAIN_LIVE = 0.05;

  const canvas = document.getElementById('resonance');
  const ctx = canvas.getContext('2d');
  const toggle = document.getElementById('transmit');
  const statusEl = document.getElementById('status');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let audio = null;
  let live = false;
  let level = 0;               // eased 0..1 visual intensity
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
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = F0;

    const gain = ac.createGain();
    gain.gain.value = 0;

    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = LFO_HZ;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = GAIN_LIVE * 0.3;
    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    lfo.start();
    return { ac, gain };
  }

  toggle.addEventListener('click', async () => {
    if (!audio) audio = initAudio();
    if (audio.ac.state === 'suspended') await audio.ac.resume();
    live = !live;
    const t = audio.ac.currentTime;
    audio.gain.gain.cancelScheduledValues(t);
    audio.gain.gain.setTargetAtTime(live ? GAIN_LIVE : 0, t, 0.4);
    document.body.classList.toggle('live', live);
    toggle.setAttribute('aria-pressed', String(live));
    toggle.textContent = live ? 'SUSPEND BROADCAST' : 'RESUME BROADCAST';
    statusEl.textContent = live ? 'LIVE' : 'STANDBY';
  });

  /* Gold shimmer transmission */
  function draw(now) {
    const t = now / 1000;
    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    // ease intensity toward target
    const target = live ? 1 : 0.22;
    level += (target - level) * 0.03;

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

    // shimmer sparks riding the carrier
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
