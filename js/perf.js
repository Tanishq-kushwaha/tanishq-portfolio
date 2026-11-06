/* =========================================================
   js/perf.js — runtime FPS watchdog
   Initial heuristic (inline head) obviously-weak devices ko
   pehle hi flag kar deta hai. Ye file real FPS sample karke
   un devices ko bhi catch karti hai jo heuristic se bach gaye.
========================================================= */
(function () {
    'use strict';

    const root = document.documentElement;

    if (root.getAttribute('data-perf') === 'lite') return;
    if (root.getAttribute('data-perf') === 'full') return; // manual override
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const WINDOW_MS = 1500;
    const FPS_THRESHOLD = 42;
    const MAX_STRIKES = 2;
    const START_DELAY_MS = 4000; // loader (~2.25s) + intro (~1.7s) ke baad

    let frames = 0, windowStart = 0, strikes = 0, active = false;

    function enterLite() {
        active = false;
        root.setAttribute('data-perf', 'lite');
        window.dispatchEvent(new CustomEvent('perfchange', {
            detail: { mode: 'lite' }
        }));
    }

    function sample(now) {
        if (!active) return;

        // Hidden tab pe rAF ~1fps pe throttle hota hai — skip
        if (document.hidden) {
            windowStart = 0; frames = 0;
            requestAnimationFrame(sample);
            return;
        }

        if (!windowStart) { windowStart = now; frames = 0; }
        frames += 1;

        const elapsed = now - windowStart;
        if (elapsed >= WINDOW_MS) {
            const fps = (frames * 1000) / elapsed;
            strikes = fps < FPS_THRESHOLD ? strikes + 1 : 0;
            if (strikes >= MAX_STRIKES) { enterLite(); return; }
            windowStart = 0; frames = 0;
        }
        requestAnimationFrame(sample);
    }

    function start() {
        if (active || root.getAttribute('data-perf') === 'lite') return;
        active = true;
        windowStart = 0; frames = 0;
        requestAnimationFrame(sample);
    }

    setTimeout(start, START_DELAY_MS);

    // User agar mid-session reduced-motion ON kare → sampling band
    const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (rmq.addEventListener) rmq.addEventListener('change', e => { if (e.matches) active = false; });
})();