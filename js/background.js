/* =========================================================
   js/background.js
   Theme-aware animated background — advanced edition.

   Dark theme  -> twinkling stars with soft violet glow
   Light theme -> drifting violet dust with organic breathing

   Improvements over previous version:
   - More particles (scaled by viewport area)
   - Soft glow around stars (shadowBlur)
   - Dust tinted violet to match the new theme accent
   - Slower, more organic motion (dual-sine waves, non-repetitive)
   - Smooth fade between themes (no jarring snap)
   - Reduced-motion + tab-hidden support preserved
   - dpr cap preserved for performance

   Tweak the PALETTES object if you want more or fewer particles.
   ========================================================= */

(function () {
    'use strict';

    const canvas = document.getElementById('bg-canvas');
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext('2d');
    const root = document.documentElement;
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const TAU = Math.PI * 2;

    /* ---------- Tunable palettes ---------- */
    const PALETTES = {
        dark: {
            // Most stars are near-white; ~30% get a lavender tint for depth
            starColor: '222, 226, 255',
            starColorAlt: '200, 190, 255',

            // How many stars per million pixels of viewport (scaled)
            baseStarCount: 130,

            // Twinkle speed (lower = slower, more elegant)
            twinkleSpeedMin: 0.004,
            twinkleSpeedMax: 0.018,

            // Size range in CSS pixels
            starRadiusMin: 0.3,
            starRadiusMax: 1.8,

            // Very slow horizontal crawl
            driftRange: 0.02,

            // Soft halo around each star
            glowBlur: 8,
            glowColor: '180, 170, 255'
        },
        light: {
            // Matches the theme's violet accent
            dustColor: '167, 139, 250',

            baseDustCount: 110,

            dustRadiusMin: 0.6,
            dustRadiusMax: 3.4,

            // Slower drift = more organic floating
            driftSpeedMin: 0.02,
            driftSpeedMax: 0.10,

            // Each particle breathes at its own pace
            pulseSpeedMin: 0.0006,
            pulseSpeedMax: 0.0016
        }
    };

    /* ---------- State ---------- */
    let currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    let stars = [];
    let dust = [];
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = null;

    // Smooth theme transition state
    // themeFade: 1 = fully visible, 0 = invisible
    // When user switches theme: fade out -> swap palette -> fade in
    let themeFade = 1;
    let themeFadeTarget = 1;
    let pendingTheme = null;
    const THEME_FADE_SPEED = 0.12;

    /* ---------- Particle factories ---------- */

    function createStar() {
        const p = PALETTES.dark;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            r: p.starRadiusMin + Math.random() * (p.starRadiusMax - p.starRadiusMin),
            baseAlpha: 0.35 + Math.random() * 0.5,

            // Two phases so the twinkle never repeats in a simple loop
            phaseA: Math.random() * TAU,
            phaseB: Math.random() * TAU,

            twinkle: p.twinkleSpeedMin + Math.random() * (p.twinkleSpeedMax - p.twinkleSpeedMin),
            drift: (Math.random() - 0.5) * 2 * p.driftRange,

            // ~30% of stars use the lavender tint
            useAlt: Math.random() < 0.3
        };
    }

    function createDust() {
        const p = PALETTES.light;
        const speed = p.driftSpeedMin + Math.random() * (p.driftSpeedMax - p.driftSpeedMin);
        const angle = Math.random() * TAU;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            r: p.dustRadiusMin + Math.random() * (p.dustRadiusMax - p.dustRadiusMin),
            baseAlpha: 0.15 + Math.random() * 0.35,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,

            // Two phases + individual pulse speed = each dust particle
            // breathes differently (organic, no synchronized rhythm)
            phaseA: Math.random() * TAU,
            phaseB: Math.random() * TAU,
            pulseSpeed: p.pulseSpeedMin + Math.random() * (p.pulseSpeedMax - p.pulseSpeedMin)
        };
    }

    /* Scale particle count by viewport area.
       Small screens get fewer, big screens get more. */
    function getScaledCount(baseCount) {
        const areaMP = (window.innerWidth * window.innerHeight) / 1_000_000;
        return Math.max(20, Math.round(baseCount * Math.min(areaMP, 2)));
    }

    function rebuildParticles() {
        const starCount = getScaledCount(PALETTES.dark.baseStarCount);
        const dustCount = getScaledCount(PALETTES.light.baseDustCount);

        stars = new Array(starCount);
        for (let i = 0; i < starCount; i += 1) stars[i] = createStar();

        dust = new Array(dustCount);
        for (let i = 0; i < dustCount; i += 1) dust[i] = createDust();
    }

    /* ---------- Resize ---------- */
    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2); // Retina cap for memory
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

    /* ---------- Draw functions ---------- */

    function drawStars(time) {
        const p = PALETTES.dark;

        // Soft glow — set once per frame, applies to all stars drawn below.
        // NOTE: shadowBlur is comparatively expensive. If you notice lag on
        // low-end phones, reduce baseStarCount or lower glowBlur.
        ctx.shadowBlur = p.glowBlur;
        ctx.shadowColor = 'rgb(' + p.glowColor + ')';

        for (let i = 0; i < stars.length; i += 1) {
            const star = stars[i];

            // Layered twinkle — combine two slow sine waves at different
            // speeds. The result feels organic instead of a repetitive pulse.
            const twinkleA = Math.sin(time * star.twinkle + star.phaseA);
            const twinkleB = Math.sin(time * star.twinkle * 0.6 + star.phaseB);
            const twinkle = (twinkleA + twinkleB) * 0.5;

            const alpha = Math.max(0, (star.baseAlpha + twinkle * 0.25) * themeFade);

            ctx.fillStyle = star.useAlt
                ? 'rgb(' + p.starColorAlt + ')'
                : 'rgb(' + p.starColor + ')';
            ctx.globalAlpha = alpha;

            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, TAU);
            ctx.fill();

            // Slow horizontal drift with wrap-around
            star.x += star.drift;
            if (star.x < 0) star.x = width;
            else if (star.x > width) star.x = 0;
        }

        // Reset shared canvas state so the next frame starts clean
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    function drawDust(time) {
        const p = PALETTES.light;
        ctx.fillStyle = 'rgb(' + p.dustColor + ')';

        for (let i = 0; i < dust.length; i += 1) {
            const d = dust[i];

            // Two slow sine waves at slightly different speeds = organic
            // "breathing" that never lands on a fixed rhythm.
            const pulseA = Math.sin(time * d.pulseSpeed + d.phaseA);
            const pulseB = Math.sin(time * d.pulseSpeed * 0.7 + d.phaseB);
            const pulse = 0.6 + (pulseA + pulseB) * 0.2; // ~0.2 to 1.0

            // Radius also breathes slightly — adds subtle depth
            const radiusPulse = 0.85 + (pulseA + pulseB) * 0.1; // ~0.65 to 1.05x

            const alpha = Math.max(0, d.baseAlpha * pulse * themeFade);

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r * radiusPulse, 0, TAU);
            ctx.fill();

            // Drift + wrap
            d.x += d.vx;
            d.y += d.vy;
            if (d.x < -10) d.x = width + 10;
            else if (d.x > width + 10) d.x = -10;
            if (d.y < -10) d.y = height + 10;
            else if (d.y > height + 10) d.y = -10;
        }

        ctx.globalAlpha = 1;
    }

    /* ---------- Animation frame ---------- */

    function animationFrame(now) {
        const time = now || performance.now();

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
            drawStars(time);
        } else {
            drawDust(time);
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

        if (currentTheme === 'dark') drawStars(0);
        else drawDust(0);
    }

    /* ---------- Control ---------- */

    function startAnimation() {
        if (rafId === null) rafId = requestAnimationFrame(animationFrame);
    }

    function stopAnimation() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function syncAnimationState() {
        const isPaused = reduceMotionQuery.matches || document.hidden;

        if (isPaused) {
            stopAnimation();
            if (reduceMotionQuery.matches && !document.hidden) {
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

        // Instant swap for users who prefer reduced motion
        if (reduceMotionQuery.matches) {
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

    // script.js dispatches `themechange` when user toggles the theme
    document.addEventListener('themechange', function (event) {
        if (event.detail && event.detail.theme) {
            updateBackgroundTheme(event.detail.theme);
        }
    });

    /* ---------- Boot ---------- */
    resize();
})();