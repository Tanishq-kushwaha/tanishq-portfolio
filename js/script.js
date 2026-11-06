/* =========================================================
   script.js — Advanced motion layer
   Custom cursor • split reveals • marquee • 3D tilt • skew

   STEP 3 additions:
   - Lenis smooth scroll driven by GSAP's single ticker
   - Anchor links routed through Lenis (with focus management)
   - Retimed reveals + batch stagger + light hero parallax
   - Clean Lenis destroy when reduced-motion is toggled on
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

    /* ---------- Storage ---------- */
    const storage = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch { } }
    };

    /* ---------- Theme ---------- */
    const themeBtn = document.getElementById('theme-toggle');
    const root = document.documentElement;

    const setTheme = (theme) => {
        const isDark = theme === 'dark';
        if (isDark) {
            root.setAttribute('data-theme', 'dark');
            themeBtn.textContent = '☀️ Light Mode';
        } else {
            root.removeAttribute('data-theme');
            themeBtn.textContent = '🌙 Dark Mode';
        }
        storage.set('theme', isDark ? 'dark' : 'light');
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: isDark ? 'dark' : 'light' }
        }));
    };

    setTheme(storage.get('theme') || 'light');
    themeBtn.addEventListener('click', () => {
        setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    /* =========================================================
     Sticky header + Active nav (unified)
     ─────────────────────────────────────────────────────────
     Both UI states derive from the same scroll position, so they
     share one `syncScrollUI()` function. It runs on:
       • native window `scroll` (baseline — fires for BOTH native
         scroll and Lenis, since Lenis calls window.scrollTo on every
         RAF; also the only listener that survives reduced-motion)
       • Lenis `scroll` event (fires at RAF rate, no browser
         throttling — more reliable on some devices)

     Memo guards (lastSticky / lastActiveId) skip DOM writes when
     nothing changed, so double-invocation per frame is free.

     NOTE: This block runs BEFORE the reduced-motion bail, so the
     native listener is always attached — sticky header and active
     link keep working when Lenis is disabled or destroyed.
  ========================================================= */
    const header = document.querySelector('header');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = Array.from(navLinks)
        .map((l) => document.querySelector(l.getAttribute('href')))
        .filter(Boolean);

    let lastSticky = null;
    let lastActiveId = null;

    const syncScrollUI = () => {
        // 1. Sticky header
        const shouldStick = window.scrollY > 0;
        if (shouldStick !== lastSticky) {
            header.classList.toggle('sticky', shouldStick);
            lastSticky = shouldStick;
        }

        // 2. Active nav link (scan bottom-up for nearest section above viewport)
        const cur = window.scrollY + 150;
        for (let i = sections.length - 1; i >= 0; i--) {
            if (cur >= sections[i].offsetTop) {
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
    window.addEventListener('load', syncScrollUI);
    syncScrollUI();

    /* ---------- Mobile nav ---------- */
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    if (hamburger) {
        // The hamburger is a <div> in HTML — make it behave like a button
        // so keyboard and screen-reader users can open the mobile menu.
        hamburger.setAttribute('role', 'button');
        hamburger.setAttribute('tabindex', '0');
        hamburger.setAttribute('aria-label', 'Toggle navigation menu');
        hamburger.setAttribute('aria-expanded', 'false');

        // Enter / Space should toggle it just like a click
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

        // FIX: if GSAP failed to load (or reduced-motion is on),
        // .scroll-cue stays at opacity: 0 forever, because only the
        // intro timeline was setting it to 0.7. Force it visible
        // here so the cue isn't permanently invisible for no-GSAP users.
        // (Reduced-motion CSS already forces opacity: 0.7 !important,
        // so this mainly helps the GSAP-failed case.)
        const scrollCueEl = document.querySelector('.scroll-cue');
        if (scrollCueEl) {
            scrollCueEl.style.opacity = '0.7';
            scrollCueEl.classList.add('is-ready');
        }

        return;
    }
    /* =========================================================
       STEP 3 — SMOOTH SCROLL (Lenis) + ScrollTrigger
       =========================================================
       THE CORE IDEA
       ─────────────
       GSAP and Lenis both want their own requestAnimationFrame loop.
       If they run separately, ScrollTrigger reads a scroll position
       Lenis hasn't finished writing → scrubbed tweens stutter and
       parallax drifts.

       THE FIX (canonical, production pattern)
       ───────────────────────────────────────
       1. Create Lenis with `autoRaf: false` — GSAP owns the loop.
       2. On every Lenis scroll → tell ScrollTrigger to re-read scroll.
       3. Drive Lenis from gsap.ticker (ONE RAF for the whole page).
          GSAP's ticker time is SECONDS; Lenis.raf() wants MILLISECONDS.
       4. gsap.ticker.lagSmoothing(0) so scroll timing stays 1:1.

       MOBILE
       ──────
       `syncTouch: false` (the default) — native iOS/Android momentum
       is already excellent. Forcing Lenis's exponential follow on touch
       is the #1 cause of “laggy on phone”. Touch keeps native feel;
       mouse wheel gets the premium smoothing.

       REDUCED MOTION
       ──────────────
       Lenis is never created (the early bail above already returned).
       If the user flips the OS setting mid-session, we destroy Lenis
       and remove the ticker callback → instant native scroll again.
    ========================================================= */
    let lenis = null;

    // Diagnostic experiment: touch devices keep native browser scrolling.
    // Lenis remains desktop-only so GSAP's ticker never runs on coarse pointers,
    // the existing native scroll listeners continue to drive sticky nav updates,
    // and anchor navigation still uses the browser default on touch devices.
    if (typeof Lenis !== 'undefined' && isFine) {
        lenis = new Lenis({
            autoRaf: false,                          // GSAP ticker drives it
            duration: 1.2,                           // 1.1–1.3 = premium, not floaty
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
            smoothWheel: true,
            syncTouch: false,                        // native momentum on touch
            wheelMultiplier: 1,
            touchMultiplier: 1.15
        });

        // Every Lenis scroll tick → ScrollTrigger re-reads the position.
        lenis.on('scroll', ScrollTrigger.update);

        // Also drive the sticky header + active nav from Lenis directly.
        // Fires at RAF rate (no browser throttling) → the active link
        // tracks the smoothed scroll position exactly, without the tiny
        // lag you get from waiting on native scroll events.
        lenis.on('scroll', syncScrollUI);


        // ONE RAF LOOP for the entire site.
        const lenisTicker = (time) => lenis.raf(time * 1000);
        gsap.ticker.add(lenisTicker);
        gsap.ticker.lagSmoothing(0);

        /* ---------- Anchor links through Lenis ----------
           Native hash jumps would teleport the page and Lenis would
           have to “catch up”. Route them through lenis.scrollTo so
           the nav links glide. The existing mobile-menu close handler
           still runs first (it was registered earlier and does not
           preventDefault). External links are unaffected because the
           selector only matches `href^="#"`.
        -------------------------------------------------- */
        document.querySelectorAll('a[href^="#"]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (!href || href === '#' || href.length < 2) return;

                const target = document.querySelector(href);
                if (!target) return;

                // If Lenis was destroyed mid-session (user toggled
                // reduced-motion ON), fall back to native anchor jump.
                // Do NOT call preventDefault — let the browser handle it.
                if (!lenis) return;

                e.preventDefault();

                // -90px ≈ header height + a little breathing room
                lenis.scrollTo(target, { offset: -90, duration: 1.35 });

                // Keep keyboard accessibility: move focus without a
                // second scroll jump.
                target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            });
        });

        /* ---------- Clean destroy on mid-session reduced-motion ---------- */
        const onReduceMotionChange = (e) => {
            if (!e.matches || !lenis) return;

            gsap.ticker.remove(lenisTicker);
            lenis.destroy();
            lenis = null;

            // Restore GSAP's default lag smoothing values
            gsap.ticker.lagSmoothing(500, 33);
        };

        if (reduceMotionQuery.addEventListener) {
            reduceMotionQuery.addEventListener('change', onReduceMotionChange);
        } else if (reduceMotionQuery.addListener) {
            reduceMotionQuery.addListener(onReduceMotionChange); // old Safari
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
            // CSS handles centering via `translate: -50% -50%`.
            // GSAP only writes x/y movement — no percentage offset here,
            // otherwise we get a double-centering bug (off-screen ring).
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

            // Elements with [data-cursor] show their label inside the ring
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

    /* Intro timeline — starts PAUSED. The loader plays it once the
     loading screen fades out. This gives us clean sequencing:
     loader (2s) → fade out → intro reveal (1.7s) → float.

     GSAP .from() tweens still render their initial state immediately
     even while the timeline is paused — so the hero stays hidden
     behind the loader. When we .play(), everything animates. */
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
        /* Float starts 1.7s into the intro — after the clip-reveal
           finishes. Animates the inner <img>, not the wrapper, so it
           stays independent of pointer-tilt and scroll parallax. */
        .add(() => {
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
        });

    /* =========================================================
       LOADING SCREEN
       ~1.8s count + 0.45s fade = ~2.25s total. Then introTl plays.
    ========================================================= */
    const loader = document.getElementById('loader');
    const loaderFill = document.querySelector('.loader-bar-fill');
    const loaderCount = document.querySelector('.loader-count');

    if (loader) {
        const counter = { v: 0 };

        gsap.timeline()
            .to(counter, {
                v: 100,
                duration: 1.8,
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
        // No loader in DOM (edge case) — play intro immediately
        introTl.play();
    }

    /* =========================================================
       SECTION HEADINGS — SPLIT REVEAL
       STEP 3: slightly later start + smoother ease + longer
       word duration = more editorial, less “pop-in”.
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

    Why 2 clones?
    ─────────────
    With only 1 clone (2 tracks), a gap flashes on the right
    edge at the end of each 30s loop on wide screens. Two
    clones = 3 total tracks. Since each track is ~2600px on
    desktop, 3 tracks = ~7800px of coverage — plenty for any
    monitor up to 5K, with zero seam gap.

    Why 6 items in HTML?
    ────────────────────
    .marquee-item:nth-child(even) alternates the styling.
    With 5 items, the loop seam showed serif→serif. With 6
    items (serif, sans, serif, sans, serif, sans) the seam
    is serif→sans, so alternation stays perfect across the
    invisible loop boundary.
 ========================================================= */
    const marqueeTrack = document.querySelector('.marquee-track');
    if (marqueeTrack) {
        // Create two clones so the strip never reveals a gap
        const clone1 = marqueeTrack.cloneNode(true);
        const clone2 = marqueeTrack.cloneNode(true);

        // Screen readers should only read the original track
        clone1.setAttribute('aria-hidden', 'true');
        clone2.setAttribute('aria-hidden', 'true');

        // Append both after the original
        marqueeTrack.parentNode.appendChild(clone1);
        marqueeTrack.parentNode.appendChild(clone2);

        // Animate all three together — each moves -100% of its own width,
        // so the loop is perfectly seamless
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
    if (isFine) {
        document.querySelectorAll('.project-card, .cert-card').forEach((card) => {
            gsap.set(card, { transformPerspective: 900 });
            const rotX = gsap.quickTo(card, 'rotationX', { duration: 0.5, ease: 'power2' });
            const rotY = gsap.quickTo(card, 'rotationY', { duration: 0.5, ease: 'power2' });

            card.addEventListener('pointermove', (e) => {
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
    if (isFine) {
        document.querySelectorAll('.btn, .btn-small').forEach((btn) => {
            const xTo = gsap.quickTo(btn, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.3)' });
            const yTo = gsap.quickTo(btn, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.3)' });

            btn.addEventListener('pointermove', (e) => {
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
    const skewSetter = gsap.quickSetter('main > section', 'skewY', 'deg');
    const proxy = { skew: 0 };

    ScrollTrigger.create({
        onUpdate: (self) => {
            const v = self.getVelocity();
            const skew = gsap.utils.clamp(-6, 6, v / -180);
            if (Math.abs(skew) > Math.abs(proxy.skew)) {
                proxy.skew = skew;
                gsap.to(proxy, {
                    skew: 0,
                    duration: 0.9,
                    ease: 'power3',
                    overwrite: true,
                    onUpdate: () => skewSetter(proxy.skew)
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
       STEP 3 — SCROLL STORYTELLING
       =========================================================
       Two small upgrades, deliberately restrained:

       1. HERO PARALLAX
          The wrapper moves, the inner <img> keeps its float.
          No conflict: the intro float targets `.hero-image img`,
          this targets `.hero-image`. scrub:true (no extra smoothing)
          because Lenis is already smoothing the scroll.

       2. REVEALS
          Slightly later start (top 86% vs 88%), longer duration,
          power4.out ease. Grid items (cards, skill tags) use
          ScrollTrigger.batch so they cascade — one trigger per
          viewport entry instead of one per element, which is both
          cheaper and feels more intentional.
    ========================================================= */

    /* Hero image parallax — very light, exits as the hero scrolls away */
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

    /* Single-element reveal — text blocks, buttons */
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

    /* Batched reveal — grids: cards, certs, skill tags.
       Set initial state once, then animate each batch with stagger.
       `once: true` means no re-hiding on scroll-back. */
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

    /* Footer — ONE trigger on the footer wrapper, not per-child.
       Why single trigger?
       - Per-child triggers require each child to individually reach
         `top 88%`. The last child (status) sits near page bottom —
         on mobile with a hidden address bar and `ignoreMobileResize`,
         the threshold gets "stuck" at the smaller pre-scroll viewport
         height, so the trigger fires later than expected.

       Why `top 95%`?
       - Fires as soon as the footer barely enters the viewport,
         bypassing any viewport-height mismatch.

       Why stagger?
       - Keeps the original nice reveal rhythm — brand → copyright →
         status, one after another, not all at once.
    */
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

    /* Scroll progress bar — scrub:true so Lenis handles the smoothing,
       not a second lerp layer (which reads as a laggy bar). */
    const progressBar = document.querySelector('.scroll-progress');
    if (progressBar) {
        gsap.to(progressBar, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: true }
        });
    }

    /* Refresh after fonts load */
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    window.addEventListener('load', () => ScrollTrigger.refresh());
})();