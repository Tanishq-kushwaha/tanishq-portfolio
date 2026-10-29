/* =========================================================
   js/background.js
   ---------------------------------------------------------
   Cosmic (dark) + Aurora (light) animated background.

   Kaise kaam karta hai:
   - Ek fixed <canvas> page ke peeche lagta hai
   - Theme ke hisaab se particles + glow change hote hain
   - Theme toggle se colors smoothly update hote hain
   - Reduced-motion / hidden tab pe animation pause hoti hai

   Edit karne ke liye neeche CONFIG object dekho.
========================================================= */

(function () {
    'use strict';

    /* -----------------------------------------------------
       CONFIG – yahan se colors, speed, density change karo
    ----------------------------------------------------- */
    const CONFIG = {
        particlesPer1000px: 28,
        particlesPer1000pxMobile: 14,
        minSize: 0.6,
        maxSize: 2.2,
        speedMin: 0.08,
        speedMax: 0.35,
        twinkleSpeed: 0.008,
        blobCount: 4,
        blobSpeed: 0.00025
    };

    // Dark theme – Cosmic
    const DARK = {
        bg: '#05050a',
        particle: [
            'rgba(180, 190, 255, 0.9)',
            'rgba(139, 92, 246, 0.75)',
            'rgba(99, 102, 241, 0.7)',
            'rgba(200, 220, 255, 0.55)'
        ],
        blob: [
            'rgba(88, 28, 135, 0.18)',
            'rgba(30, 58, 138, 0.14)',
            'rgba(67, 56, 202, 0.12)',
            'rgba(15, 23, 42, 0.2)'
        ]
    };

    // Light theme – Aurora
    const LIGHT = {
        bg: '#f4f6fb',
        particle: [
            'rgba(99, 102, 241, 0.35)',
            'rgba(139, 92, 246, 0.28)',
            'rgba(56, 189, 248, 0.3)',
            'rgba(165, 180, 252, 0.25)'
        ],
        blob: [
            'rgba(165, 180, 252, 0.22)',
            'rgba(125, 211, 252, 0.18)',
            'rgba(196, 181, 253, 0.16)',
            'rgba(186, 230, 253, 0.14)'
        ]
    };

    let canvas = null;
    let ctx = null;
    let particles = [];
    let blobs = [];
    let animationId = null;
    let isDark = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let reducedMotion = false;
    let isVisible = true;

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function getPalette() {
        return isDark ? DARK : LIGHT;
    }

    function getParticleCount() {
        const per1000 = width < 768
            ? CONFIG.particlesPer1000pxMobile
            : CONFIG.particlesPer1000px;
        return Math.max(8, Math.round((width / 1000) * per1000));
    }

    function createParticle() {
        const palette = getPalette();
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            size: randomBetween(CONFIG.minSize, CONFIG.maxSize),
            speedX: randomBetween(-CONFIG.speedMax, CONFIG.speedMax) * 0.4,
            speedY: randomBetween(CONFIG.speedMin, CONFIG.speedMax),
            opacity: randomBetween(0.25, 0.95),
            twinkle: Math.random() * Math.PI * 2,
            color: palette.particle[Math.floor(Math.random() * palette.particle.length)]
        };
    }

    function createBlob(index) {
        const palette = getPalette();
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            radius: randomBetween(width * 0.18, width * 0.38),
            speedX: randomBetween(-CONFIG.blobSpeed, CONFIG.blobSpeed) * width,
            speedY: randomBetween(-CONFIG.blobSpeed, CONFIG.blobSpeed) * height,
            color: palette.blob[index % palette.blob.length]
        };
    }

    function rebuildParticles() {
        const count = getParticleCount();
        particles = [];
        for (let i = 0; i < count; i++) {
            particles.push(createParticle());
        }
        blobs = [];
        for (let i = 0; i < CONFIG.blobCount; i++) {
            blobs.push(createBlob(i));
        }
    }

    function resizeCanvas() {
        if (!canvas) return;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rebuildParticles();
    }

    function drawFrame() {
        if (!ctx) return;
        const palette = getPalette();

        ctx.fillStyle = palette.bg;
        ctx.fillRect(0, 0, width, height);

        // Soft blobs (nebula / aurora)
        blobs.forEach((blob) => {
            blob.x += blob.speedX;
            blob.y += blob.speedY;
            if (blob.x < -blob.radius) blob.x = width + blob.radius;
            if (blob.x > width + blob.radius) blob.x = -blob.radius;
            if (blob.y < -blob.radius) blob.y = height + blob.radius;
            if (blob.y > height + blob.radius) blob.y = -blob.radius;

            const gradient = ctx.createRadialGradient(
                blob.x, blob.y, 0,
                blob.x, blob.y, blob.radius
            );
            gradient.addColorStop(0, blob.color);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Particles / stars
        particles.forEach((p) => {
            p.x += p.speedX;
            p.y += p.speedY;
            p.twinkle += CONFIG.twinkleSpeed;
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;

            const alpha = p.opacity * (0.55 + 0.45 * Math.sin(p.twinkle));
            ctx.globalAlpha = Math.max(0.05, Math.min(1, alpha));
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function loop() {
        if (!isVisible || reducedMotion) {
            drawFrame();
            return;
        }
        drawFrame();
        animationId = window.requestAnimationFrame(loop);
    }

    function startLoop() {
        stopLoop();
        if (reducedMotion) {
            drawFrame();
            return;
        }
        animationId = window.requestAnimationFrame(loop);
    }

    function stopLoop() {
        if (animationId) {
            window.cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function updateBackgroundTheme(theme) {
        isDark = theme === 'dark';
        rebuildParticles();
        drawFrame();
    }

    function handleVisibility() {
        isVisible = document.visibilityState === 'visible';
        if (isVisible) startLoop();
        else stopLoop();
    }

    function handleReducedMotion(event) {
        reducedMotion = event.matches;
        if (reducedMotion) {
            stopLoop();
            drawFrame();
        } else {
            startLoop();
        }
    }

    function initializeCosmicBackground() {
        canvas = document.getElementById('bg-canvas');
        if (!canvas) {
            console.warn('bg-canvas not found');
            return;
        }
        ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        isDark = document.body.getAttribute('data-theme') === 'dark';
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        resizeCanvas();
        startLoop();

        window.addEventListener('resize', resizeCanvas, { passive: true });
        document.addEventListener('visibilitychange', handleVisibility);
        window.matchMedia('(prefers-reduced-motion: reduce)')
            .addEventListener('change', handleReducedMotion);
    }

    window.PortfolioBackground = {
        init: initializeCosmicBackground,
        updateTheme: updateBackgroundTheme,
        stop: stopLoop,
        start: startLoop
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCosmicBackground);
    } else {
        initializeCosmicBackground();
    }
})();