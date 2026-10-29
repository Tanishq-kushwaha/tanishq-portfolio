/* =========================================================
   js/background.js
   Theme-aware animated background.

   - Dark theme  -> cosmic stars (twinkling) + CSS nebula blobs
   - Light theme -> drifting luminous dust + CSS aurora blobs
   - Reduced motion pe bas ek static frame draw hota hai
   - Page hidden (tab switch) pe animation pause ho jati hai
   - themechange event pe theme switch hota hai (script.js dispatch karta hai)

   Customize karna ho to PALETTES object ke numbers badlo.
========================================================= */

(function () {
    'use strict';

    const canvas = document.getElementById('bg-canvas');
    if (!canvas || !canvas.getContext) return; // Canvas support nahi to CSS gradient fallback chalega

    const ctx = canvas.getContext('2d');
    const root = document.documentElement;
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const TAU = Math.PI * 2;

    /* ---------- Tunable palettes ---------- */
    const PALETTES = {
        dark: {
            starColor: '222, 226, 255',      // RGB string — sky-blue white
            baseStarCount: 90,               // 1M pixels area ke liye
            twinkleSpeedMin: 0.008,
            twinkleSpeedMax: 0.025,
            starRadiusMin: 0.3,
            starRadiusMax: 1.6,
            driftRange: 0.03                 // pixels/frame slow horizontal drift
        },
        light: {
            dustColor: '130, 150, 235',      // thoda richer blue-purple
            baseDustCount: 70,                // 45 se badhaya — zyada depth
            dustRadiusMin: 0.8,               // chhote particles bhi
            dustRadiusMax: 3.2,               // bade soft glows tak
            driftSpeedMin: 0.04,              // drift thoda slow = zyada elegant
            driftSpeedMax: 0.15
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

    /* ---------- Particle factories ---------- */
    function createStar() {
        const p = PALETTES.dark;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            r: p.starRadiusMin + Math.random() * (p.starRadiusMax - p.starRadiusMin),
            baseAlpha: 0.35 + Math.random() * 0.5,
            phase: Math.random() * TAU,
            twinkle: p.twinkleSpeedMin + Math.random() * (p.twinkleSpeedMax - p.twinkleSpeedMin),
            drift: (Math.random() - 0.5) * 2 * p.driftRange
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
            phase: Math.random() * TAU
        };
    }

    /* Viewport area (million pixels) ke hisaab se count scale karo.
       Chhoti screen par particles kam, badi par zyada. */
    function getScaledCount(baseCount) {
        const areaMP = (window.innerWidth * window.innerHeight) / 1_000_000;
        return Math.max(15, Math.round(baseCount * Math.min(areaMP, 2)));
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
        dpr = Math.min(window.devicePixelRatio || 1, 2); // Retina par memory limit
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
        ctx.fillStyle = 'rgb(' + PALETTES.dark.starColor + ')';
        for (let i = 0; i < stars.length; i += 1) {
            const star = stars[i];
            const twinkle = Math.sin(time * star.twinkle + star.phase);
            const alpha = star.baseAlpha + twinkle * 0.25;
            ctx.globalAlpha = alpha > 0 ? alpha : 0;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, TAU);
            ctx.fill();

            // Slow horizontal drift + wrap-around
            star.x += star.drift;
            if (star.x < 0) star.x = width;
            else if (star.x > width) star.x = 0;
        }
        ctx.globalAlpha = 1;
    }

    function drawDust(time) {
        ctx.fillStyle = 'rgb(' + PALETTES.light.dustColor + ')';
        for (let i = 0; i < dust.length; i += 1) {
            const d = dust[i];
            const pulse = 0.7 + Math.sin(time * 0.001 + d.phase) * 0.3;
            ctx.globalAlpha = d.baseAlpha * pulse;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.r, 0, TAU);
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

    /* Ek frame draw karo, phir requestAnimationFrame schedule karo */
    function animationFrame(now) {
        const time = now || performance.now();
        ctx.clearRect(0, 0, width, height);

        if (currentTheme === 'dark') {
            drawStars(time);
        } else {
            drawDust(time);
        }

        rafId = requestAnimationFrame(animationFrame);
    }

    /* Reduced motion ke liye single static frame */
    function drawStaticFrame() {
        ctx.clearRect(0, 0, width, height);
        if (currentTheme === 'dark') {
            drawStars(0);
        } else {
            drawDust(0);
        }
    }

    /* ---------- Control ---------- */
    function startAnimation() {
        if (rafId === null) {
            rafId = requestAnimationFrame(animationFrame);
        }
    }

    function stopAnimation() {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    /* Reduced motion ya page hidden ho to pause / static draw */
    function syncAnimationState() {
        const isPaused = reduceMotionQuery.matches || document.hidden;

        if (isPaused) {
            stopAnimation();
            if (reduceMotionQuery.matches && !document.hidden) {
                // Static frame taki background blank na lage
                drawStaticFrame();
            } else {
                ctx.clearRect(0, 0, width, height);
            }
        } else {
            startAnimation();
        }
    }

    /* Theme switch — sirf relevant palette draw hogi next frame se */
    function updateBackgroundTheme(theme) {
        currentTheme = theme === 'dark' ? 'dark' : 'light';
        syncAnimationState();
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

    // script.js se themechange event aata hai
    document.addEventListener('themechange', function (event) {
        if (event.detail && event.detail.theme) {
            updateBackgroundTheme(event.detail.theme);
        }
    });

    /* ---------- Boot ---------- */
    resize();
})();