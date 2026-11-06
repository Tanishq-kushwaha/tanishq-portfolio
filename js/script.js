/* =========================================================
   script.js — Advanced motion layer
   Custom cursor • split reveals • marquee • 3D tilt • skew

   STEP 3 additions:
   - Lenis smooth scroll driven by GSAP's single ticker
   - Anchor links routed through Lenis (with focus management)
   - Retimed reveals + batch stagger + light hero parallax
   - Clean Lenis destroy when reduced-motion is toggled on

   POLISH PASS (M1 + M3 + M6):
   - M1: Section offsets cached → no per-frame offsetTop reads
   - M3: Hero float killed on perfchange + gated in intro
   - M6: themeBtn null-safe (no crash if button removed)
========================================================= */
(function () {
    'use strict';

    // Lock scroll immediately — removed once loader fades out.
    document.body.classList.add('is-loading');

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const hasGSAP = !!(gsap && ScrollTrigger);

    if (hasGSAP) {
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
    }

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduceMotion = reduceMotionQuery.matches;
    const isFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let liteMode = document.documentElement.getAttribute('data-perf') === 'lite';
    const skewSetter = hasGSAP ? gsap.quickSetter('main > section', 'skewY', 'deg') : null;
    const skewProxy = { skew: 0 };

    window.addEventListener('perfchange', function () {
        liteMode = true;
        // Bug 7 fix — agar skew mid-tween tha to section tilted na reh jaye
        if (skewSetter) {
            gsap.killTweensOf(skewProxy);
            skewProxy.skew = 0;
            skewSetter(0);
        }
        // M3: kill any ongoing hero float tween
        if (hasGSAP) {
            gsap.killTweensOf('.hero-image img');
            gsap.set('.hero-image img', { y: 0 });
        }
    });

    /* ---------- Storage ---------- */
    const storage = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch { } }
    };

    /* ---------- Theme ---------- */
    const themeBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;

    // M6: null-safe — button missing ho to crash na ho
    const setTheme = (theme) => {
        const isDark = theme === 'dark';
        if (isDark) {
            root.setAttribute('data-theme', 'dark');
            if (themeBtn) themeBtn.textContent = '☀️ Light Mode';
        } else {
            root.removeAttribute('data-theme');
            if (themeBtn) themeBtn.textContent = '🌙 Dark Mode';
        }
        storage.set('theme', isDark ? 'dark' : 'light');
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: isDark ? 'dark' : 'light' }
        }));
    };

    setTheme(storage.get('theme') || 'light');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        });
    }

    /* =========================================================
     Sticky header + Active nav (unified)
  ========================================================= */
    const header = document.querySelector('header');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = Array.from(navLinks)
        .map((l) => document.querySelector(l.getAttribute('href')))
        .filter(Boolean);

    // M1: cache section offsets — avoids forced reflow on every scroll frame
    let sectionOffsets = [];
    const recalcSectionOffsets = () => {
        sectionOffsets = sections.map((s) => s.offsetTop);
    };

    let lastSticky = null;
    let lastActiveId = null;

    const syncScrollUI = () => {
        // 1. Sticky header
        const shouldStick = window.scrollY > 0;
        if (shouldStick !== lastSticky) {
            header.classList.toggle('sticky', shouldStick);
            lastSticky = shouldStick;
        }

        // 2. Active nav link — uses cached offsets (no reflow)
        const cur = window.scrollY + 150;
        for (let i = sectionOffsets.length - 1; i >= 0; i--) {
            if (cur >= sectionOffsets[i]) {
                const id = '#' + sections[i].id;
                if (id !== lastActiveId) {
                    navLinks.forEach((l) =>
                        l.classList.toggle('active', l.getAttribute('href') === id)
                    );
                    lastActiveId = id;
                }
                return;
            }
        }
    };

    window.addEventListener('scroll', syncScrollUI, { passive: true });
    window.addEventListener('load', () => { recalcSectionOffsets(); syncScrollUI(); });
    window.addEventListener('resize', recalcSectionOffsets, { passive: true });
    recalcSectionOffsets();
    syncScrollUI();

    // Recalc after web fonts swap (fixes sub-pixel drift from font metric changes)
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(recalcSectionOffsets);
    }

    /* ---------- Mobile nav ---------- */
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    if (hamburger) {
        hamburger.setAttribute('role', 'button');
        hamburger.setAttribute('tabindex', '0');
        hamburger.setAttribute('aria-label', 'Toggle navigation menu');
        hamburger.setAttribute('aria-expanded', 'false');

        hamburger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                hamburger.click();
            }
        });

        hamburger.addEventListener('click', () => {
            const expanded = hamburger.classList.toggle('active');
            navMenu.classList.toggle('active', expanded);
            hamburger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
    }

    document.querySelectorAll('.nav-links a').forEach((link) => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navMenu?.classList.remove('active');
            hamburger?.setAttribute('aria-expanded', 'false');
        });
    });

    /* ---------- Reduced motion / no GSAP — bail early ---------- */
    if (!hasGSAP || reduceMotion) {
        document.querySelectorAll('.hero-image img').forEach((el) => {
            el.style.clipPath = 'inset(0)';
        });

        const loaderEl = document.getElementById('loader');
        if (loaderEl) loaderEl.classList.add('is-hidden');
        document.body.classList.remove('is-loading');

        const progressBar = document.querySelector('.scroll-progress');
        if (progressBar) {
            const updateProgress = () => {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                const ratio = max > 0 ? window.scrollY / max : 0;
                progressBar.style.transform = `scaleX(${ratio})`;
            };
            window.addEventListener('scroll', updateProgress, { passive: true });
            updateProgress();
        }

        const scrollCueEl = document.querySelector('.scroll-cue');
        if (scrollCueEl) {
            scrollCueEl.style.opacity = '0.7';
            scrollCueEl.classList.add('is-ready');
        }

        const typedEl = document.getElementById('typed-name');
        const roleEl2 = document.getElementById('dynamic-role');
        if (typedEl) typedEl.textContent = 'Tanishq Kushwaha';
        if (roleEl2) roleEl2.textContent = 'Junior Software Developer';

        if (!hasGSAP) {
            document.querySelectorAll('.cursor-dot, .cursor-ring').forEach((el) => {
                el.style.display = 'none';
            });
            document.documentElement.style.setProperty('cursor', 'auto', 'important');
        }

        return;
    }

    /* =========================================================
       SMOOTH SCROLL (Lenis) + ScrollTrigger
    ========================================================= */
    let lenis = null;

    if (typeof Lenis !== 'undefined' && isFine) {
        lenis = new Lenis({
            autoRaf: false,
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            syncTouch: false,
            wheelMultiplier: 1,
            touchMultiplier: 1.15
        });

        lenis.on('scroll', ScrollTrigger.update);
        lenis.on('scroll', syncScrollUI);

        const lenisTicker = (time) => lenis.raf(time * 1000);
        gsap.ticker.add(lenisTicker);
        gsap.ticker.lagSmoothing(0);

        document.querySelectorAll('a[href^="#"]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (!href || href === '#' || href.length < 2) return;

                const target = document.querySelector(href);
                if (!target) return;
                if (!lenis) return;

                e.preventDefault();
                lenis.scrollTo(target, { offset: -90, duration: 1.35 });
                target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            });
        });

        const onReduceMotionChange = (e) => {
            if (!e.matches || !lenis) return;
            gsap.ticker.remove(lenisTicker);
            lenis.destroy();
            lenis = null;
            gsap.ticker.lagSmoothing(500, 33);
        };

        if (reduceMotionQuery.addEventListener) {
            reduceMotionQuery.addEventListener('change', onReduceMotionChange);
        } else if (reduceMotionQuery.addListener) {
            reduceMotionQuery.addListener(onReduceMotionChange);
        }
    }

    /* =========================================================
       TEXT SPLITTER
    ========================================================= */
    function splitWords(el) {
        if (!el || el.dataset.split) return [];
        const textNodes = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
            if (n.textContent.trim()) textNodes.push(n);
        }

        const words = [];
        textNodes.forEach((tn) => {
            const parts = tn.textContent.split(/(\s+)/);
            const frag = document.createDocumentFragment();
            parts.forEach((part) => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                    frag.appendChild(document.createTextNode(part));
                    return;
                }
                const wrap = document.createElement('span');
                wrap.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;';
                const inner = document.createElement('span');
                inner.style.cssText = 'display:inline-block;will-change:transform;';
                inner.textContent = part;
                wrap.appendChild(inner);
                frag.appendChild(wrap);
                words.push(inner);
            });
            tn.parentNode.replaceChild(frag, tn);
        });

        el.dataset.split = '1';
        return words;
    }

    /* =========================================================
       CUSTOM CURSOR — contextual label mode
    ========================================================= */
    if (isFine) {
        const dot = document.querySelector('.cursor-dot');
        const ring = document.querySelector('.cursor-ring');
        const label = document.querySelector('.cursor-label');

        if (dot && ring) {
            gsap.set(dot, { x: 0, y: 0 });
            gsap.set(ring, { x: 0, y: 0 });

            const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
            const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
            const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
            const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });

            window.addEventListener('pointermove', (e) => {
                dotX(e.clientX); dotY(e.clientY);
                ringX(e.clientX); ringY(e.clientY);
            });

            document.querySelectorAll('[data-cursor]').forEach((el) => {
                el.addEventListener('pointerenter', () => {
                    if (label) label.textContent = el.dataset.cursor.toUpperCase();
                    ring.classList.add('label-mode');
                    dot.classList.add('hidden');
                });
                el.addEventListener('pointerleave', () => {
                    ring.classList.remove('label-mode');
                    dot.classList.remove('hidden');
                });
            });
        }
    }

    /* =========================================================
       HERO TIMELINE
    ========================================================= */
    const typedName = document.getElementById('typed-name');
    const roleEl = document.getElementById('dynamic-role');
    const fullName = 'Tanishq Kushwaha';
    const roles = ['Junior Software Developer', 'Frontend Developer', 'Problem Solver'];

    let roleIdx = 0;
    let charIdx = 0;
    let deleting = false;

    function startRoleRotation() {
        const cur = roles[roleIdx];
        if (deleting) {
            roleEl.textContent = cur.substring(0, charIdx - 1);
            charIdx -= 1;
        } else {
            roleEl.textContent = cur.substring(0, charIdx + 1);
            charIdx += 1;
        }
        let speed = deleting ? 40 : 75;
        if (!deleting && charIdx === cur.length) {
            speed = 2000;
            deleting = true;
        } else if (deleting && charIdx === 0) {
            deleting = false;
            roleIdx = (roleIdx + 1) % roles.length;
            speed = 400;
        }
        setTimeout(startRoleRotation, speed);
    }

    function typeName(cb) {
        let i = 0;
        function tick() {
            if (i < fullName.length) {
                typedName.textContent += fullName[i++];
                setTimeout(tick, 70);
            } else if (cb) {
                cb();
            }
        }
        tick();
    }

    const introTl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } });

    introTl
        .from('.hero-eyebrow', { y: 14, opacity: 0, duration: 0.7 }, 0.05)
        .from('.hero-content h1', { y: 60, opacity: 0, duration: 1 }, 0.1)
        .fromTo('.hero-image img',
            { clipPath: 'inset(0 0 100% 0)' },
            { clipPath: 'inset(0 0 0 0)', duration: 1.4, ease: 'expo.inOut' },
            0.3
        )
        .from('.hero-orbit', { opacity: 0, scale: 0.92, duration: 1 }, 0.85)
        .from('.dynamic-text', { y: 20, opacity: 0, duration: 0.6 }, 0.95)
        .from('.hero-buttons .btn', { y: 20, opacity: 0, duration: 0.6, stagger: 0.1 }, 1.05)
        .add(() => {
            typeName(() => setTimeout(startRoleRotation, 300));
        }, 0.9)
        .add(() => {
            // M3: agar lite mode mid-session trigger ho chuka hai, float skip
            if (liteMode) return;
            gsap.to('.hero-image img', {
                y: -14,
                duration: 3.4,
                ease: 'sine.inOut',
                yoyo: true,
                repeat: -1
            });
        }, 1.7)
        .to('.scroll-cue', {
            opacity: 0.7,
            duration: 0.6,
            ease: 'power2.out',
            onComplete: () => {
                document.querySelector('.scroll-cue')?.classList.add('is-ready');
            }
        }, 1.95)
        .call(() => {
            ScrollTrigger.refresh();
            gsap.set('.hero-image img', { willChange: 'auto' });
        });

    /* =========================================================
       LOADING SCREEN
    ========================================================= */
    const loader = document.getElementById('loader');
    const loaderFill = document.querySelector('.loader-bar-fill');
    const loaderCount = document.querySelector('.loader-count');

    if (loader) {
        const counter = { v: 0 };

        gsap.timeline()
            .to(counter, {
                v: 100,
                duration: 1.2,
                ease: 'power2.inOut',
                onUpdate: () => {
                    const val = Math.round(counter.v);
                    if (loaderCount) loaderCount.textContent = val + '%';
                    if (loaderFill) loaderFill.style.width = val + '%';
                }
            })
            .to(loader, {
                opacity: 0,
                duration: 0.45,
                ease: 'power2.out',
                onStart: () => document.body.classList.remove('is-loading'),
                onComplete: () => {
                    loader.classList.add('is-hidden');
                    loader.setAttribute('aria-hidden', 'true');
                    introTl.play();
                }
            }, '+=0.15');
    } else {
        introTl.play();
    }

    /* =========================================================
       SECTION HEADINGS — SPLIT REVEAL
    ========================================================= */
    document.querySelectorAll('.section-head h2').forEach((h2) => {
        const words = splitWords(h2);
        if (!words.length) return;

        gsap.set(words, { y: 34, opacity: 0, rotate: 2 });

        ScrollTrigger.create({
            trigger: h2,
            start: 'top 83%',
            once: true,
            onEnter: () => {
                gsap.to(words, {
                    y: 0,
                    opacity: 1,
                    rotate: 0,
                    duration: 1.15,
                    ease: 'power4.out',
                    stagger: 0.09
                });
            }
        });
    });

    /* =========================================================
       MARQUEE
    ========================================================= */
    const marqueeTrack = document.querySelector('.marquee-track');
    if (marqueeTrack) {
        const clone1 = marqueeTrack.cloneNode(true);
        const clone2 = marqueeTrack.cloneNode(true);

        clone1.setAttribute('aria-hidden', 'true');
        clone2.setAttribute('aria-hidden', 'true');

        marqueeTrack.parentNode.appendChild(clone1);
        marqueeTrack.parentNode.appendChild(clone2);

        gsap.to([marqueeTrack, clone1, clone2], {
            xPercent: -100,
            repeat: -1,
            duration: 30,
            ease: 'linear'
        });
    }

    /* =========================================================
       3D TILT ON CARDS
    ========================================================= */
    if (isFine && !liteMode) {
        document.querySelectorAll('.project-card, .cert-card').forEach((card) => {
            gsap.set(card, { transformPerspective: 900 });
            const rotX = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2' });
            const rotY = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2' });

            card.addEventListener('pointermove', (e) => {
                if (liteMode) return;
                const r = card.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top) / r.height - 0.5;
                rotX(-y * 11);
                rotY(x * 11);
            });
            card.addEventListener('pointerleave', () => { rotX(0); rotY(0); });
        });
    }

    /* =========================================================
       ELASTIC MAGNETIC BUTTONS
    ========================================================= */
    if (isFine && !liteMode) {
        document.querySelectorAll('.btn, .btn-small').forEach((btn) => {
            const xTo = gsap.quickTo(btn, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.3)' });
            const yTo = gsap.quickTo(btn, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.3)' });

            btn.addEventListener('pointermove', (e) => {
                if (liteMode) return;
                const r = btn.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.42);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.42);
            });
            btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
        });
    }

    /* =========================================================
       SCROLL VELOCITY SKEW
    ========================================================= */
    ScrollTrigger.create({
        onUpdate: (self) => {
            if (liteMode) return;
            const v = self.getVelocity();
            const skew = gsap.utils.clamp(-6, 6, v / -180);
            if (Math.abs(skew) > Math.abs(skewProxy.skew)) {
                skewProxy.skew = skew;
                gsap.to(skewProxy, {
                    skew: 0,
                    duration: 0.9,
                    ease: 'power3',
                    overwrite: true,
                    onUpdate: () => skewSetter(skewProxy.skew)
                });
            }
        }
    });

    /* =========================================================
       NUMBER COUNTERS
    ========================================================= */
    document.querySelectorAll('.stat-num').forEach((el) => {
        const target = parseFloat(el.dataset.count || el.textContent);
        if (isNaN(target)) return;
        const suffix = el.dataset.suffix || '';
        const obj = { v: 0 };

        ScrollTrigger.create({
            trigger: el,
            start: 'top 85%',
            once: true,
            onEnter: () => {
                gsap.to(obj, {
                    v: target,
                    duration: 1.6,
                    ease: 'power2.out',
                    onUpdate: () => {
                        el.textContent = Math.round(obj.v) + suffix;
                    }
                });
            }
        });
    });

    /* =========================================================
       SCROLL STORYTELLING
    ========================================================= */

    /* Hero image parallax */
    gsap.to('.hero-image', {
        yPercent: -10,
        ease: 'none',
        scrollTrigger: {
            trigger: '.hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true
        }
    });

    const reveal = (selector, opts = {}) => {
        gsap.utils.toArray(selector).forEach((el) => {
            gsap.from(el, {
                y: opts.y ?? 44,
                opacity: 0,
                duration: opts.duration ?? 1.05,
                ease: opts.ease ?? 'power4.out',
                scrollTrigger: {
                    trigger: el,
                    start: opts.start ?? 'top 86%',
                    once: true
                }
            });
        });
    };

    const revealStagger = (selector, opts = {}) => {
        const els = gsap.utils.toArray(selector);
        if (!els.length) return;

        gsap.set(els, { y: opts.y ?? 56, opacity: 0 });

        ScrollTrigger.batch(els, {
            start: opts.start ?? 'top 86%',
            once: true,
            onEnter: (batch) => {
                gsap.to(batch, {
                    y: 0,
                    opacity: 1,
                    duration: opts.duration ?? 1.05,
                    ease: opts.ease ?? 'power4.out',
                    stagger: opts.stagger ?? 0.1
                });
            }
        });
    };

    reveal('.about-text');
    reveal('#contact-text');
    reveal('.contact-links .btn', { y: 18, duration: 0.7 });

    revealStagger('.skill-tag', { y: 18, stagger: 0.045, duration: 0.55, start: 'top 90%' });
    revealStagger('.project-card', { y: 56, stagger: 0.12, duration: 1.05 });
    revealStagger('.cert-card', { y: 44, stagger: 0.1, duration: 0.95 });

    const footerEl = document.querySelector('.premium-footer');
    if (footerEl) {
        gsap.from('.footer-container > *', {
            y: 30,
            opacity: 0,
            duration: 0.8,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: {
                trigger: footerEl,
                start: 'top 95%',
                once: true
            }
        });
    }

    const progressBar = document.querySelector('.scroll-progress');
    if (progressBar) {
        gsap.to(progressBar, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: true }
        });
    }

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    window.addEventListener('load', () => ScrollTrigger.refresh());
})();