/* =========================================================
   js/cursor-trail.js
   Premium cursor particle trail.

   ─────────────────────────────────────────────────────────
   Design goals
   ─────────────
   - Subtle, editorial. NOT a neon explosion.
   - Soft glowing dots + occasional sparks + rare triangles.
   - 50-particle hard cap.
   - Theme-aware (burnt orange in light, apricot in dark).
   - Runs only on (hover: hover) + (pointer: fine),
     and only when prefers-reduced-motion is NOT set.

   Coexists with:
   - Existing custom cursor (dot + ring + label-mode)
   - Magnetic buttons, 3D tilt, scroll skew
   - The separate background particle canvas (background.js)

   If --accent / --accent-strong change in styles.css,
   update THEME_COLORS below to match.
   ========================================================= */
(function () {
    'use strict';

    /* ---------- Guards ---------- */
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

       // Hard bail before any DOM work if any guard is active.
    // Mobile / tablet / reduced-motion / lite-mode users
    // never get the extra canvas at all.
    if (reduceMotionQuery.matches) return;
    if (!finePointerQuery.matches) return;
    if (document.documentElement.getAttribute('data-perf') === 'lite') return;


    /* ---------- Tunables ---------- */
    const MAX_PARTICLES = 50;          // hard cap, matches spec (45–55)
    const DPR_CAP = 2;
    const MAX_SPAWNS_PER_FRAME = 8;    // prevents burst on huge cursor jumps

    /* ---------- Theme colors ----------
       Kept in sync with styles.css (Ember & Ink):
         light  --accent        : #c2410c  -> "194, 65, 12"
         light  --accent-strong : #9a3412  -> "154, 52, 18"
         dark   --accent        : #ff9a5c  -> "255, 154, 92"
         dark   --accent-strong : #ffb77a  -> "255, 183, 122"
       Stored as "R, G, B" strings so we can build rgba() on the fly.
    */
    const THEME_COLORS = {
        light: { primary: '194, 65, 12',   secondary: '154, 52, 18' },
        dark:  { primary: '255, 154, 92',  secondary: '255, 183, 122' }
    };

    let currentTheme =
        document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'dark' : 'light';

    let trailEnabled = true;

    /* ---------- Canvas ---------- */
    const canvas = document.createElement('canvas');
    canvas.id = 'cursor-trail-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;' +
        'pointer-events:none;z-index:9998;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d', { alpha: true });

    let dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    let width = window.innerWidth;
    let height = window.innerHeight;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---------- Pre-rendered glow sprites ----------
       Cheaper than shadowBlur per frame, and looks softer.
       One sprite per theme so switching is instant.
    */
    function buildGlowSprite(rgb) {
        const size = 96;
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const octx = off.getContext('2d');
        const cx = size / 2;
        const grad = octx.createRadialGradient(cx, cx, 0, cx, cx, cx);
        grad.addColorStop(0,    `rgba(${rgb}, 1)`);
        grad.addColorStop(0.30, `rgba(${rgb}, 0.55)`);
        grad.addColorStop(0.65, `rgba(${rgb}, 0.12)`);
        grad.addColorStop(1,    `rgba(${rgb}, 0)`);
        octx.fillStyle = grad;
        octx.fillRect(0, 0, size, size);
        return off;
    }

    const sprites = {
        light: buildGlowSprite(THEME_COLORS.light.primary),
        dark:  buildGlowSprite(THEME_COLORS.dark.primary)
    };

    /* ---------- Particle state ---------- */
    const particles = [];
    let lastMouseX = -1000;
    let lastMouseY = -1000;
    let lastSpawnX = 0;
    let lastSpawnY = 0;
    let animId = null;
    let prevTime = 0;

    /* ---------- Spawning ---------- */
    function spawnParticle(x, y, dx, dy, speed) {
        // Recycle oldest when full — O(n) shift, but n ≤ 50 → trivial
        if (particles.length >= MAX_PARTICLES) particles.shift();

        // Distribution: 74% dot, 20% line, 6% triangle
        const r = Math.random();
        const type = r < 0.74 ? 'dot' : (r < 0.94 ? 'line' : 'tri');

        // Drift backward from movement direction with random spread
        const moveAngle = Math.atan2(dy, dx) || Math.random() * Math.PI * 2;
        const backAngle = moveAngle + Math.PI + (Math.random() - 0.5) * 0.9;
        const backSpeed = (0.3 + Math.random() * 1.0) *
                          Math.min(1 + speed * 0.08, 3.2);

        const life = 0.5 + Math.random() * 0.55; // 0.5 → 1.05 s
        const size =
            type === 'dot'  ? 1   + Math.random() * 2.4 :
            type === 'line' ? 0.9 + Math.random() * 1.4 :
                              2   + Math.random() * 2.2;

        particles.push({
            type,
            x: x + (Math.random() - 0.5) * 5,
            y: y + (Math.random() - 0.5) * 5,
            vx: Math.cos(backAngle) * backSpeed + (Math.random() - 0.5) * 0.35,
            vy: Math.sin(backAngle) * backSpeed + (Math.random() - 0.5) * 0.35,
            size,
            // Line length grows with cursor speed → longer streaks on fast moves
            len: 5 + Math.random() * 9 + Math.min(speed * 0.6, 14),
            age: 0,
            life,
            phase: Math.random() * Math.PI * 2,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 2.4
        });
    }

    /* ---------- Physics ---------- */
    function updateParticles(dt) {
        const step = dt * 60; // normalise to ~60 fps units
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.age += dt;
            if (p.age >= p.life) { particles.splice(i, 1); continue; }

            // Organic sine wobble — makes the trail feel alive, not mechanical
            const driftX = Math.sin(p.age * 3.1 + p.phase) * 0.18;
            const driftY = Math.cos(p.age * 2.6 + p.phase * 1.3) * 0.18;

            p.x += (p.vx + driftX) * step;
            p.y += (p.vy + driftY) * step;

            // Damp velocity so particles settle before dying
            p.vx *= 0.965;
            p.vy *= 0.965;

            if (p.type === 'tri') p.rot += p.rotSpeed * dt;
        }
    }

    /* ---------- Draw ---------- */
    function drawParticles() {
        ctx.clearRect(0, 0, width, height);
        if (!particles.length) return;

        const colors = THEME_COLORS[currentTheme];
        const sprite = sprites[currentTheme];

        // Dark bg: additive 'lighter' → real glow.
        // Light bg: normal compositing → subtle, not washed out.
        ctx.globalCompositeOperation =
            currentTheme === 'dark' ? 'lighter' : 'source-over';

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const lifeT = p.age / p.life;
            const lifeAlpha = 1 - lifeT;

            // Quadratic ease-out fade — slow start, quick finish
            const alpha = lifeAlpha * lifeAlpha * 0.9;
            if (alpha <= 0.01) continue;

            if (p.type === 'dot') {
                const s = p.size * 5 * (1 + lifeT * 0.4); // grows as it fades
                ctx.globalAlpha = alpha;
                ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);

            } else if (p.type === 'line') {
                const angle = Math.atan2(p.vy, p.vx);
                const half = (p.len * (0.3 + lifeAlpha * 0.7)) / 2;
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = `rgb(${colors.secondary})`;
                ctx.lineWidth = p.size;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(p.x - Math.cos(angle) * half, p.y - Math.sin(angle) * half);
                ctx.lineTo(p.x + Math.cos(angle) * half, p.y + Math.sin(angle) * half);
                ctx.stroke();

            } else { // tri
                const sz = p.size * (0.5 + lifeAlpha * 0.5);
                ctx.globalAlpha = alpha * 0.85;
                ctx.fillStyle = `rgb(${colors.primary})`;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.beginPath();
                ctx.moveTo(0, -sz);
                ctx.lineTo(sz * 0.866, sz * 0.5);
                ctx.lineTo(-sz * 0.866, sz * 0.5);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- Animation loop ---------- */
    function loop(now) {
        if (!prevTime) prevTime = now;
        let dt = (now - prevTime) / 1000;
        prevTime = now;
        if (dt > 0.05) dt = 0.05; // clamp after tab switch

        updateParticles(dt);
        drawParticles();

        // Stop the loop when there's nothing left to animate.
        // Restarts automatically on the next spawn → zero idle cost.
        if (particles.length === 0) {
            animId = null;
            ctx.clearRect(0, 0, width, height);
            return;
        }

        animId = requestAnimationFrame(loop);
    }

    function startLoop() {
        if (animId === null) {
            prevTime = 0;
            animId = requestAnimationFrame(loop);
        }
    }

    function stopLoop() {
        if (animId !== null) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        ctx.clearRect(0, 0, width, height);
    }

    /* ---------- Pointer handler ---------- */
    function handlePointerMove(e) {
        if (!trailEnabled) return;

        const x = e.clientX;
        const y = e.clientY;

        // First move (or re-entry after blur) — just seed the reference point
        if (lastMouseX < -100) {
            lastMouseX = x;
            lastMouseY = y;
            lastSpawnX = x;
            lastSpawnY = y;
            return;
        }

        const dx = x - lastMouseX;
        const dy = y - lastMouseY;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.5) {
            // Speed-adaptive threshold: faster cursor = tighter spacing = denser trail
            const threshold = Math.max(2.5, 8 - Math.min(dist, 30) * 0.22);

            const rx = x - lastSpawnX;
            const ry = y - lastSpawnY;
            const rd = Math.hypot(rx, ry);

            if (rd >= threshold) {
                const ux = rx / rd;
                const uy = ry / rd;

                // How many evenly-spaced spawns fit between lastSpawn and current?
                const totalSteps = Math.min(
                    Math.floor(rd / threshold),
                    MAX_SPAWNS_PER_FRAME
                );

                if (totalSteps > 0) {
                    const stepDist = rd / totalSteps;
                    for (let s = 1; s <= totalSteps; s++) {
                        spawnParticle(
                            lastSpawnX + ux * stepDist * s,
                            lastSpawnY + uy * stepDist * s,
                            dx, dy, dist
                        );
                    }
                }

                lastSpawnX = x;
                lastSpawnY = y;
            }
        }

        lastMouseX = x;
        lastMouseY = y;

        if (particles.length > 0 && animId === null) startLoop();
    }

    function handlePointerLeave() {
        // Reset reference so re-entry doesn't spawn a line across the screen
        lastMouseX = -1000;
        lastMouseY = -1000;
    }

    /* ---------- Theme sync ---------- */
    document.addEventListener('themechange', (e) => {
        if (e.detail && e.detail.theme) {
            currentTheme = e.detail.theme === 'dark' ? 'dark' : 'light';
            // No redraw needed here — next rAF frame picks up
            // the new color and sprite automatically.
        }
    });

    // Safety net: if something sets data-theme directly without firing the event
    document.addEventListener('visibilitychange', () => {
        currentTheme =
            document.documentElement.getAttribute('data-theme') === 'dark'
                ? 'dark' : 'light';
    });

    /* ---------- Dynamic reduced-motion toggle ---------- */
    function onReduceMotionChange(e) {
        trailEnabled = !e.matches;
        if (!trailEnabled) {
            particles.length = 0;
            stopLoop();
        }
    }
    if (reduceMotionQuery.addEventListener) {
        reduceMotionQuery.addEventListener('change', onReduceMotionChange);
    } else if (reduceMotionQuery.addListener) {
        reduceMotionQuery.addListener(onReduceMotionChange); // old Safari
    }

    /* ---------- Pause when tab hidden ---------- */
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopLoop();
        // Loop restarts automatically on the next spawn after the user moves
    });

     /* ---------- Dynamic lite-mode downgrade (M4) ---------- */
    window.addEventListener('perfchange', function () {
        trailEnabled = false;
        particles.length = 0;
        stopLoop();
    });

    /* ---------- Init ---------- */
    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('blur', handlePointerLeave);
    document.addEventListener('pointerleave', handlePointerLeave);
})();