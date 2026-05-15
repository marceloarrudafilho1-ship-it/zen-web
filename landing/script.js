/* ─────────────────────────────────────────────────────────
   Zen — hero canvas: a breathing wallet cluster graph.
   Force-directed nodes (one bright "your wallet" hub, several
   co-spenders, a halo of externals), with rose particles that
   travel along edges. Mouse perturbs the field gently.
   No deps. Honors prefers-reduced-motion.
   ───────────────────────────────────────────────────────── */

(() => {
  const canvas = document.getElementById('viz');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // sizing with DPR
  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ── world ─────────────────────────────────────────────── */

  // Tier 0: hub (your wallet). Tier 1: co-spenders. Tier 2: externals.
  const NODES = [];
  const EDGES = [];
  const PARTICLES = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function build() {
    NODES.length = 0;
    EDGES.length = 0;
    PARTICLES.length = 0;

    // hub at center
    NODES.push({
      x: W * 0.5, y: H * 0.5, vx: 0, vy: 0,
      tier: 0, r: 11, hue: 14,
    });

    // co-spenders — ring around hub
    const ring1 = 7;
    for (let i = 0; i < ring1; i++) {
      const a = (i / ring1) * Math.PI * 2 + rand(-0.2, 0.2);
      const dist = Math.min(W, H) * rand(0.22, 0.28);
      NODES.push({
        x: W * 0.5 + Math.cos(a) * dist,
        y: H * 0.5 + Math.sin(a) * dist,
        vx: 0, vy: 0,
        tier: 1, r: rand(4.5, 6.5),
        hue: i % 2 === 0 ? 14 : 348,
      });
    }

    // externals — outer halo
    const ring2 = 14;
    for (let i = 0; i < ring2; i++) {
      const a = (i / ring2) * Math.PI * 2 + rand(-0.35, 0.35);
      const dist = Math.min(W, H) * rand(0.36, 0.46);
      NODES.push({
        x: W * 0.5 + Math.cos(a) * dist,
        y: H * 0.5 + Math.sin(a) * dist,
        vx: 0, vy: 0,
        tier: 2, r: rand(2.2, 3.4),
        hue: 0,
      });
    }

    // edges: hub→co-spenders, co-spenders→externals (sparse)
    for (let i = 1; i <= ring1; i++) EDGES.push({ a: 0, b: i, w: rand(0.6, 1) });
    for (let i = 1; i <= ring1; i++) {
      const externalsToConnect = Math.floor(rand(1, 3));
      for (let k = 0; k < externalsToConnect; k++) {
        const target = 1 + ring1 + Math.floor(Math.random() * ring2);
        EDGES.push({ a: i, b: target, w: rand(0.25, 0.55) });
      }
    }
    // a few co-spender ↔ co-spender edges for richness
    for (let k = 0; k < 4; k++) {
      const a = 1 + Math.floor(Math.random() * ring1);
      let b = 1 + Math.floor(Math.random() * ring1);
      if (a !== b) EDGES.push({ a, b, w: rand(0.35, 0.6) });
    }
  }
  build();

  /* ── mouse ─────────────────────────────────────────────── */

  let mouse = { x: -9999, y: -9999, active: false };
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
  });
  canvas.addEventListener('pointerleave', () => { mouse.active = false; mouse.x = -9999; });

  /* ── particles ─────────────────────────────────────────── */

  function spawnParticle() {
    if (PARTICLES.length > 14) return;
    const e = EDGES[Math.floor(Math.random() * EDGES.length)];
    if (!e) return;
    const reverse = Math.random() < 0.5;
    PARTICLES.push({
      e,
      t: 0,
      speed: rand(0.005, 0.014),
      reverse,
      hue: Math.random() < 0.55 ? 14 : 348,
    });
  }

  /* ── physics ───────────────────────────────────────────── */

  function step(dt) {
    // Gentle spring forces toward "rest" radii from center.
    const cx = W * 0.5, cy = H * 0.5;
    for (let i = 0; i < NODES.length; i++) {
      const n = NODES[i];
      if (n.tier === 0) {
        // hub eases back to center
        n.vx += (cx - n.x) * 0.02;
        n.vy += (cy - n.y) * 0.02;
      } else {
        const dx = n.x - cx, dy = n.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const rest = (n.tier === 1 ? 0.25 : 0.41) * Math.min(W, H);
        const pull = (rest - d) * 0.0015;
        n.vx += (dx / d) * pull * 80;
        n.vy += (dy / d) * pull * 80;

        // small breathing tangential drift
        const t = performance.now() * 0.0002 + i;
        n.vx += -Math.sin(t) * 0.012;
        n.vy +=  Math.cos(t) * 0.012;
      }

      // mouse repulsion (subtle)
      if (mouse.active) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 18000) {
          const f = (1 - d2 / 18000) * 0.6;
          n.vx += (dx / Math.sqrt(d2 || 1)) * f;
          n.vy += (dy / Math.sqrt(d2 || 1)) * f;
        }
      }

      // node-node repulsion (cheap O(n²), n ≈ 22)
      for (let j = 0; j < NODES.length; j++) {
        if (i === j) continue;
        const m = NODES[j];
        const dx = n.x - m.x, dy = n.y - m.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 2400 && d2 > 0.01) {
          const f = (1 - d2 / 2400) * 0.18;
          const d = Math.sqrt(d2);
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
        }
      }

      n.vx *= 0.86;
      n.vy *= 0.86;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
    }

    // particles
    if (Math.random() < 0.06) spawnParticle();
    for (let i = PARTICLES.length - 1; i >= 0; i--) {
      const p = PARTICLES[i];
      p.t += p.speed * dt;
      if (p.t >= 1) PARTICLES.splice(i, 1);
    }
  }

  /* ── render ────────────────────────────────────────────── */

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // soft dot grid
    const gridStep = 28;
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = (W / 2) % gridStep; x < W; x += gridStep) {
      for (let y = (H / 2) % gridStep; y < H; y += gridStep) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // edges
    ctx.lineWidth = 1;
    for (const e of EDGES) {
      const a = NODES[e.a], b = NODES[e.b];
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, `oklch(0.72 0.18 14 / ${0.10 + e.w * 0.18})`);
      grad.addColorStop(1, `oklch(0.74 0.19 348 / ${0.06 + e.w * 0.14})`);
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // particles (drawn before nodes so nodes overlay them at endpoints)
    for (const p of PARTICLES) {
      const a = NODES[p.e.a], b = NODES[p.e.b];
      const t = p.reverse ? 1 - p.t : p.t;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const fade = Math.sin(p.t * Math.PI); // fade in/out across edge
      const color = p.hue === 14 ? '251,113,133' : '244,114,182';
      // glow halo
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 14);
      grd.addColorStop(0, `rgba(${color},${0.55 * fade})`);
      grd.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      // core
      ctx.fillStyle = `rgba(${color},${0.95 * fade})`;
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
    }

    // nodes
    for (const n of NODES) {
      if (n.tier === 0) {
        // hub: gradient sphere with strong glow
        const grd = ctx.createRadialGradient(n.x - n.r * 0.35, n.y - n.r * 0.35, 0, n.x, n.y, n.r * 4);
        grd.addColorStop(0, 'rgba(251,113,133,0.6)');
        grd.addColorStop(0.5, 'rgba(244,114,182,0.18)');
        grd.addColorStop(1, 'rgba(244,114,182,0)');
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2); ctx.fill();

        const core = ctx.createLinearGradient(n.x - n.r, n.y - n.r, n.x + n.r, n.y + n.r);
        core.addColorStop(0, '#fb7185');
        core.addColorStop(1, '#f472b6');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 3.5, 0, Math.PI * 2); ctx.stroke();
      } else if (n.tier === 1) {
        const color = n.hue === 14 ? '#fb7185' : '#f472b6';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(180,180,190,0.55)';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    // tiny mono labels on hub + a couple co-spenders for personality
    ctx.font = '500 11px JetBrains Mono, ui-monospace, monospace';
    ctx.fillStyle = 'rgba(231,231,234,0.85)';
    const hub = NODES[0];
    ctx.fillText('0x71c…f3a', hub.x + 16, hub.y + 4);
    if (NODES[2]) {
      ctx.fillStyle = 'rgba(231,231,234,0.55)';
      ctx.fillText('0xa12…b04', NODES[2].x + 10, NODES[2].y - 8);
    }
    if (NODES[5]) {
      ctx.fillStyle = 'rgba(231,231,234,0.55)';
      ctx.fillText('0x9d4…711', NODES[5].x + 10, NODES[5].y + 12);
    }
  }

  /* ── loop ──────────────────────────────────────────────── */

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(2.4, (now - last) / 16.666);
    last = now;
    step(dt);
    draw();
    if (!reduceMotion) requestAnimationFrame(frame);
  }
  if (reduceMotion) {
    // single static render
    step(1); draw();
  } else {
    requestAnimationFrame(frame);
  }
})();

/* ─────────────────────────────────────────────────────────
   Reveal on scroll. Toggles `.is-in` when an element with
   [data-reveal] or [data-reveal-group] enters the viewport.
   Per-element delay via data-reveal-delay="ms".
   ───────────────────────────────────────────────────────── */
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-group]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-in'));
    return;
  }

  // apply per-element delay via custom property
  targets.forEach(el => {
    const d = el.getAttribute('data-reveal-delay');
    if (d) el.style.setProperty('--reveal-delay', d + 'ms');
  });

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(el => io.observe(el));
})();

/* ─────────────────────────────────────────────────────────
   Cursor-tracked sheen on feature cards. Sets --mx / --my
   to mouse position so the ::before glow follows the pointer.
   ───────────────────────────────────────────────────────── */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (matchMedia('(hover: none)').matches) return;

  const cards = document.querySelectorAll('.feature');
  cards.forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
})();

/* ─────────────────────────────────────────────────────────
   Download tile: tiny ripple on click, just before navigation.
   ───────────────────────────────────────────────────────── */
(() => {
  const tile = document.querySelector('.dlbtn--feature');
  if (!tile) return;

  tile.addEventListener('click', (e) => {
    const r = tile.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'dlbtn__ripple';
    ripple.style.left = `${e.clientX - r.left}px`;
    ripple.style.top  = `${e.clientY - r.top}px`;
    tile.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
})();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Animated number counters. Any [data-counter] element with
   data-target="N" eases from 0 â†’ N over ~1.2s once it scrolls
   into view. Optional data-suffix appends after the number.
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('[data-counter]');
  if (targets.length === 0) return;

  const animate = (el) => {
    const target = Number(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    if (Number.isNaN(target)) return;
    if (reduceMotion) { el.textContent = target + suffix; return; }
    const dur = 1200;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (!('IntersectionObserver' in window)) {
    targets.forEach(animate);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.5 });
  targets.forEach(el => io.observe(el));
})();

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Terminal typewriter. Splits the contents of a
   [data-typewriter] <pre> on newlines and re-appends them as
   .term__line spans on a short delay so they fade in one by one.
   Preserves any inline span markup the original line had.
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = document.querySelectorAll('[data-typewriter]');
  if (els.length === 0) return;

  els.forEach((el) => {
    const original = el.innerHTML;
    if (reduceMotion) return;
    const lines = original.split('\n');
    el.innerHTML = '';

    const play = () => {
      let i = 0;
      const tick = () => {
        if (i >= lines.length) return;
        const span = document.createElement('span');
        span.className = 'term__line';
        // Append the line and the newline that the <pre> needs to render
        // the next line beneath this one.
        span.innerHTML = lines[i] + (i < lines.length - 1 ? '\n' : '');
        el.appendChild(span);
        i++;
        // Slight randomness so it feels like a process, not a script.
        const next = lines[i] && lines[i].trim() === '' ? 60 : 110 + Math.random() * 90;
        setTimeout(tick, next);
      };
      tick();
    };

    if (!('IntersectionObserver' in window)) { play(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        play();
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
  });
})();

