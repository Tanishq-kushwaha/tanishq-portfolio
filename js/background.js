/* =========================================================
   js/background.js
   Theme-aware animated background — "Ember & Ink" edition.

   Dark theme  -> rising apricot embers (3 depth layers, twinkling)
                  + large soft violet haze orbs drifting behind them
   Light theme -> soft burnt-orange motes with a few violet specks,
                  slow organic drift and breathing

   What changed vs. the teal version
   - Palette: apricot / ember / violet instead of cyan / teal
   - Light mode also gets soft peach/violet mist orbs for depth
   - Pre-rendered glow SPRITES instead of ctx.shadowBlur
     (much cheaper per frame, softer falloff)
   - Particles are drawn at high alpha — the on-screen visibility is
     controlled by `#bg-canvas { opacity }` in styles.css
     (0.85 dark / 0.6 light)
   - 3 depth layers (far / mid / near) + very light mouse parallax
   - Frame-time normalised motion (same speed on 60 / 120 / 144 Hz)

   Kept from before
   - Smooth theme cross-fade (fade out -> swap -> fade in)
   - Reduced-motion support (static frame, instant theme swap)
   - Pause when the tab is hidden
   - DPR cap of 2, particle count scaled by viewport area

   Colours: if you change --accent / --accent-2 in styles.css,
   update the RGB strings in PALETTES below.
   ========================================================= */

(function () {
    'use strict';

    const canvas = document.getElementById('bg-canvas');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const root = document.documentElement;
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    // NEW: lite mode helper
    const isLite = () => root.getAttribute('data-perf') === 'lite';

    const TAU = Math.PI * 2;

    /* ---------- Tunable palettes ----------
       All colours are "R, G, B" strings (no alpha) so they can be
       dropped into rgba() when the glow sprites are built. */
    const PALETTES = {
        dark: {
            ember: '255, 154, 92',   // --accent         #ff9a5c
            emberHot: '255, 183, 122',  // --accent-strong  #ffb77a
            haze: '124, 92, 255',   // --accent-2       #7c5cff

            // Embers per million viewport pixels (scaled, see getScaledCount)
            baseEmberCount: 190,
            // Large soft violet orbs (a few is plenty)
            hazeCount: 7,

            // Ember radius range (CSS px) — scaled further by depth layer
            emberRadiusMin: 0.9,
            emberRadiusMax: 3.1,

            // Rise speed (px per 1/60 s frame) — scaled by depth layer
            riseMin: 0.05,
            riseMax: 0.30,

            // Twinkle speed (rad per ms)
            twinkleMin: 0.0008,
            twinkleMax: 0.0034,

            // Haze orb radius range (CSS px)
            hazeRadiusMin: 160,
            hazeRadiusMax: 320
        },
        light: {
            mote: '194, 65, 12',    // --accent    #c2410c
            speck: '167, 139, 250',  // --accent-2  #a78bfa

            baseMoteCount: 150,
            // Big soft colour orbs that give the light page depth
            mistCount: 7,
            mistWarm: '232, 121, 70',   // peach-ember (lighter than --accent so it stays airy)
            mistRadiusMin: 180,
            mistRadiusMax: 340,
            // Fraction of motes that are violet specks
            speckChance: 0.3,

            moteRadiusMin: 1.3,
            moteRadiusMax: 5.4,

            driftSpeedMin: 0.03,
            driftSpeedMax: 0.14,

            pulseSpeedMin: 0.0006,
            pulseSpeedMax: 0.0016
        }
    };

    /* ---------- State ---------- */
    let currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    let embers = [];
    let hazes = [];
    let motes = [];
    let mists = [];
    let width = 0;
    let height = 0;
    let dpr = isTouchDevice ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    let rafId = null;
    let lastTime = 0;

    // Smooth theme transition state
    // themeFade: 1 = fully visible, 0 = invisible
    // When user switches theme: fade out -> swap palette -> fade in
    let themeFade = 1;
    let themeFadeTarget = 1;
    let pendingTheme = null;
    const THEME_FADE_SPEED = 0.12;

    // Mouse parallax (normalised -1..1, eased)
    let targetPX = 0;
    let targetPY = 0;
    let px = 0;
    let py = 0;
    const PARALLAX_PX = 22; // max shift for the nearest layer

    /* ---------- Glow sprites ----------
       Drawn once, reused for every particle every frame. */
    function buildSprite(rgb, size, stops) {
        const off = document.createElement('canvas');
        off.width = size;
        off.height = size;
        const octx = off.getContext('2d');
        const c = size / 2;
        const grad = octx.createRadialGradient(c, c, 0, c, c, c);
        for (let i = 0; i < stops.length; i += 1) {
            grad.addColorStop(stops[i][0], 'rgba(' + rgb + ', ' + stops[i][1] + ')');
        }
        octx.fillStyle = grad;
        octx.fillRect(0, 0, size, size);
        return off;
    }

    // Tight bright core + soft halo (embers, motes)
    const CORE_STOPS = [[0, 1], [0.18, 0.95], [0.45, 0.35], [1, 0]];
    // Very soft, wide falloff (haze orbs)
    const HAZE_STOPS = [[0, 0.55], [0.4, 0.22], [0.75, 0.06], [1, 0]];

    const sprites = {
        ember: buildSprite(PALETTES.dark.ember, 64, CORE_STOPS),
        emberHot: buildSprite(PALETTES.dark.emberHot, 64, CORE_STOPS),
        haze: buildSprite(PALETTES.dark.haze, 256, HAZE_STOPS),
        mote: buildSprite(PALETTES.light.mote, 64, CORE_STOPS),
        speck: buildSprite(PALETTES.light.speck, 64, CORE_STOPS),
        mistWarm: buildSprite(PALETTES.light.mistWarm, 256, HAZE_STOPS),
        mistViolet: buildSprite(PALETTES.light.speck, 256, HAZE_STOPS)
    };

    /* ---------- Particle factories ---------- */

    // depth: 0.35 (far, small, slow, dim) -> 1 (near, big, fast, bright)
    function createEmber() {
        const p = PALETTES.dark;
        const depth = 0.35 + Math.random() * 0.65;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            depth: depth,
            r: (p.emberRadiusMin + Math.random() * (p.emberRadiusMax - p.emberRadiusMin)) * (0.6 + depth * 0.6),
            baseAlpha: (0.45 + Math.random() * 0.5) * (0.55 + depth * 0.45),
            rise: (p.riseMin + Math.random() * (p.riseMax - p.riseMin)) * depth,

            // Gentle horizontal sway
            swayAmp: 0.05 + Math.random() * 0.18,
            swaySpeed: 0.0003 + Math.random() * 0.0009,

            // Two phases so the twinkle never repeats in a simple loop
            phaseA: Math.random() * TAU,
            phaseB: Math.random() * TAU,
            twinkle: p.twinkleMin + Math.random() * (p.twinkleMax - p.twinkleMin),

            // ~25% of embers are the brighter, paler apricot
            hot: Math.random() < 0.25
        };
    }

    function createHaze() {
        const p = PALETTES.dark;
        const angle = Math.random() * TAU;
        const speed = 0.03 + Math.random() * 0.07;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            r: p.hazeRadiusMin + Math.random() * (p.hazeRadiusMax - p.hazeRadiusMin),
            baseAlpha: 0.65 + Math.random() * 0.35,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            phase: Math.random() * TAU,
            pulseSpeed: 0.0002 + Math.random() * 0.0004
        };
    }

    function createMote() {
        const p = PALETTES.light;
        const speed = p.driftSpeedMin + Math.random() * (p.driftSpeedMax - p.driftSpeedMin);
        const angle = Math.random() * TAU;
        const depth = 0.4 + Math.random() * 0.6;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            depth: depth,
            r: (p.moteRadiusMin + Math.random() * (p.moteRadiusMax - p.moteRadiusMin)) * (0.7 + depth * 0.5),
            baseAlpha: 0.6 + Math.random() * 0.4,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            phaseA: Math.random() * TAU,
            phaseB: Math.random() * TAU,
            pulseSpeed: p.pulseSpeedMin + Math.random() * (p.pulseSpeedMax - p.pulseSpeedMin),
            speck: Math.random() < p.speckChance
        };
    }

    function createMist(i) {
        const p = PALETTES.light;
        const angle = Math.random() * TAU;
        const speed = 0.025 + Math.random() * 0.06;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            r: p.mistRadiusMin + Math.random() * (p.mistRadiusMax - p.mistRadiusMin),
            baseAlpha: 0.55 + Math.random() * 0.4,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            phase: Math.random() * TAU,
            pulseSpeed: 0.00018 + Math.random() * 0.00035,
            // alternate warm / violet so neighbours contrast
            violet: i % 2 === 1
        };
    }

    /* Scale particle count by viewport area.
   Small screens get fewer, big screens get more.
   Lite mode cuts to 30% — static frame pe bhi fewer draws. */
    function getScaledCount(baseCount) {
        const areaMP = (window.innerWidth * window.innerHeight) / 1_000_000;
        let count = Math.round(baseCount * Math.min(areaMP, 2));

        if (isLite()) count = Math.round(count * 0.3);

        if (isTouchDevice) {
            count = Math.round(count * 0.4);
            return Math.max(12, count);
        }

        return Math.max(20, count);
    }

    function rebuildParticles() {
        const emberCount = getScaledCount(PALETTES.dark.baseEmberCount);
        const moteCount = getScaledCount(PALETTES.light.baseMoteCount);
        // Fewer haze orbs on small screens
        const hazeCount = isTouchDevice
            ? 3
            : (width < 700
                ? Math.max(3, Math.round(PALETTES.dark.hazeCount / 2))
                : PALETTES.dark.hazeCount);

        embers = new Array(emberCount);
        for (let i = 0; i < emberCount; i += 1) embers[i] = createEmber();

        hazes = new Array(hazeCount);
        for (let i = 0; i < hazeCount; i += 1) hazes[i] = createHaze();

        const mistCount = isTouchDevice
            ? 3
            : (width < 700
                ? Math.max(3, Math.round(PALETTES.light.mistCount / 2))
                : PALETTES.light.mistCount);
        mists = new Array(mistCount);
        for (let i = 0; i < mistCount; i += 1) mists[i] = createMist(i);

        motes = new Array(moteCount);
        for (let i = 0; i < moteCount; i += 1) motes[i] = createMote();
    }

    /* ---------- Resize ---------- */
    function resize() {
        dpr = isTouchDevice ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rebuildParticles();
        syncAnimationState();
    }

    /* ---------- Draw functions ----------
       `time` is ms (for sine waves), `step` is the frame-time
       multiplier (1 = one 60 Hz frame; 0 = don't move, used by
       the static reduced-motion frame). */

    function drawDark(time, step) {
        // Additive blending -> embers and haze genuinely glow where they overlap
        ctx.globalCompositeOperation = 'lighter';

        // 1. Violet haze (behind everything)
        for (let i = 0; i < hazes.length; i += 1) {
            const h = hazes[i];
            const pulse = 0.75 + Math.sin(time * h.pulseSpeed + h.phase) * 0.25;
            const s = h.r * 2;

            ctx.globalAlpha = Math.max(0, h.baseAlpha * pulse * themeFade);
            ctx.drawImage(sprites.haze, h.x - h.r, h.y - h.r, s, s);

            h.x += h.vx * step;
            h.y += h.vy * step;
            // Wrap once the orb is fully off-screen
            if (h.x < -h.r) h.x = width + h.r;
            else if (h.x > width + h.r) h.x = -h.r;
            if (h.y < -h.r) h.y = height + h.r;
            else if (h.y > height + h.r) h.y = -h.r;
        }

        // 2. Embers
        for (let i = 0; i < embers.length; i += 1) {
            const e = embers[i];

            // Layered twinkle — two slow sine waves at different speeds
            const tA = Math.sin(time * e.twinkle + e.phaseA);
            const tB = Math.sin(time * e.twinkle * 0.6 + e.phaseB);
            const twinkle = (tA + tB) * 0.5;

            const alpha = Math.max(0, Math.min(1, e.baseAlpha + twinkle * 0.3) * themeFade);
            const s = e.r * 7; // sprite diameter (halo included)
            const dx = px * PARALLAX_PX * e.depth;
            const dy = py * PARALLAX_PX * e.depth;

            ctx.globalAlpha = alpha;
            ctx.drawImage(
                e.hot ? sprites.emberHot : sprites.ember,
                e.x + dx - s / 2,
                e.y + dy - s / 2,
                s, s
            );

            // Rise + sway, wrap from top back to bottom
            e.y -= e.rise * step;
            e.x += Math.sin(time * e.swaySpeed + e.phaseA) * e.swayAmp * step;
            if (e.y < -s) {
                e.y = height + s;
                e.x = Math.random() * width;
            }
            if (e.x < -s) e.x = width + s;
            else if (e.x > width + s) e.x = -s;
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    function drawLight(time, step) {
        // Normal compositing — additive would wash out on a light background

        // 1. Soft colour mist behind the motes (depth)
        for (let i = 0; i < mists.length; i += 1) {
            const g = mists[i];
            const pulse = 0.75 + Math.sin(time * g.pulseSpeed + g.phase) * 0.25;
            const s = g.r * 2;

            ctx.globalAlpha = Math.max(0, g.baseAlpha * pulse * themeFade);
            ctx.drawImage(
                g.violet ? sprites.mistViolet : sprites.mistWarm,
                g.x - g.r, g.y - g.r, s, s
            );

            g.x += g.vx * step;
            g.y += g.vy * step;
            if (g.x < -g.r) g.x = width + g.r;
            else if (g.x > width + g.r) g.x = -g.r;
            if (g.y < -g.r) g.y = height + g.r;
            else if (g.y > height + g.r) g.y = -g.r;
        }

        // 2. Motes
        for (let i = 0; i < motes.length; i += 1) {
            const m = motes[i];

            // Two slow sine waves = organic "breathing"
            const pulseA = Math.sin(time * m.pulseSpeed + m.phaseA);
            const pulseB = Math.sin(time * m.pulseSpeed * 0.7 + m.phaseB);
            const pulse = 0.65 + (pulseA + pulseB) * 0.175; // ~0.3 to 1.0
            const radiusPulse = 0.85 + (pulseA + pulseB) * 0.1;

            const alpha = Math.max(0, m.baseAlpha * pulse * themeFade);
            const s = m.r * radiusPulse * 5;
            const dx = px * PARALLAX_PX * 0.6 * m.depth;
            const dy = py * PARALLAX_PX * 0.6 * m.depth;

            ctx.globalAlpha = alpha;
            ctx.drawImage(
                m.speck ? sprites.speck : sprites.mote,
                m.x + dx - s / 2,
                m.y + dy - s / 2,
                s, s
            );

            // Drift + wrap
            m.x += m.vx * step;
            m.y += m.vy * step;
            if (m.x < -20) m.x = width + 20;
            else if (m.x > width + 20) m.x = -20;
            if (m.y < -20) m.y = height + 20;
            else if (m.y > height + 20) m.y = -20;
        }

        ctx.globalAlpha = 1;
    }

    /* ---------- Animation frame ---------- */

    function animationFrame(now) {
        const time = now || performance.now();

        // Frame-time multiplier (1 = 16.67 ms). Clamp so a tab
        // switch or long frame doesn't teleport particles.
        let step = lastTime ? (time - lastTime) / 16.667 : 1;
        if (step > 3) step = 3;
        lastTime = time;

        // Ease the parallax offset toward the pointer
        px += (targetPX - px) * 0.04;
        py += (targetPY - py) * 0.04;

        // Smooth theme fade — only runs while a transition is in progress.
        // Phase 1: fade current particles out (target = 0)
        // Phase 2: swap palette, then fade new particles in (target = 1)
        if (pendingTheme || themeFade !== themeFadeTarget) {
            themeFade += (themeFadeTarget - themeFade) * THEME_FADE_SPEED;

            // When almost invisible, swap to the new theme and fade back in
            if (pendingTheme && themeFade < 0.03) {
                currentTheme = pendingTheme;
                pendingTheme = null;
                themeFadeTarget = 1;
            }

            // Snap when close, so we don't run a tiny lerp forever
            if (Math.abs(themeFadeTarget - themeFade) < 0.005) {
                themeFade = themeFadeTarget;
            }
        }

        ctx.clearRect(0, 0, width, height);

        if (currentTheme === 'dark') {
            drawDark(time, step);
        } else {
            drawLight(time, step);
        }

        rafId = requestAnimationFrame(animationFrame);
    }

    /* Single static frame — used when reduced motion is on */
    function drawStaticFrame() {
        ctx.clearRect(0, 0, width, height);

        // If we were mid-transition, finish it instantly
        if (pendingTheme) {
            currentTheme = pendingTheme;
            pendingTheme = null;
        }
        themeFade = 1;
        themeFadeTarget = 1;
        px = 0;
        py = 0;

        if (currentTheme === 'dark') drawDark(0, 0);
        else drawLight(0, 0);
    }

    /* ---------- Control ---------- */

    function startAnimation() {
        if (rafId === null) {
            lastTime = 0;
            rafId = requestAnimationFrame(animationFrame);
        }
    }

    function stopAnimation() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function syncAnimationState() {
        const isPaused = reduceMotionQuery.matches || document.hidden || isLite();

        if (isPaused) {
            stopAnimation();
            if ((reduceMotionQuery.matches || isLite()) && !document.hidden) {
                // Draw a static frame so the background isn't blank
                drawStaticFrame();
            } else {
                ctx.clearRect(0, 0, width, height);
            }
        } else {
            startAnimation();
        }
    }

    /* ---------- Theme switch ---------- */

    function updateBackgroundTheme(theme) {
        const next = theme === 'dark' ? 'dark' : 'light';
        if (next === currentTheme && pendingTheme === null) return;

        // Instant swap for reduced-motion users AND lite mode
        if (reduceMotionQuery.matches || isLite()) {
            currentTheme = next;
            pendingTheme = null;
            themeFade = 1;
            themeFadeTarget = 1;
            drawStaticFrame();
            return;
        }


        // Smooth path: fade current particles out, then fade new ones in
        pendingTheme = next;
        themeFadeTarget = 0;
    }

    /* ---------- Events ---------- */

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', syncAnimationState);

    if (reduceMotionQuery.addEventListener) {
        reduceMotionQuery.addEventListener('change', syncAnimationState);
    } else if (reduceMotionQuery.addListener) {
        // Old Safari fallback
        reduceMotionQuery.addListener(syncAnimationState);
    }

    // NEW: watchdog ne lite mode trigger kiya → particles rebuild + static frame
    window.addEventListener('perfchange', function () {
        rebuildParticles();
        syncAnimationState();
    });

    // script.js dispatches `themechange` when user toggles the theme
    document.addEventListener('themechange', function (event) {
        if (event.detail && event.detail.theme) {
            updateBackgroundTheme(event.detail.theme);
        }
    });

    // Light mouse parallax — desktop pointers only, never with reduced motion or lite mode
    if (finePointer) {
        window.addEventListener('pointermove', function (e) {
            if (reduceMotionQuery.matches || isLite()) return;
            targetPX = (e.clientX / (width || 1)) * 2 - 1;
            targetPY = (e.clientY / (height || 1)) * 2 - 1;
        }, { passive: true });
    }

    /* ---------- Boot ---------- */
    resize();
})();