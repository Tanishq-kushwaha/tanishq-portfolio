/* =========================================================
   script.js — Advanced motion layer
   Custom cursor • split reveals • marquee • 3D tilt • skew
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

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

    /* ---------- Sticky header ---------- */
    const header = document.querySelector('header');
    const onScroll = () => header.classList.toggle('sticky', window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------- Mobile nav ---------- */
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    hamburger?.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links a').forEach((link) => {
        link.addEventListener('click', () => {
            hamburger?.classList.remove('active');
            navMenu?.classList.remove('active');
        });
    });

    /* ---------- Active nav link ---------- */
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = Array.from(navLinks)
        .map((l) => document.querySelector(l.getAttribute('href')))
        .filter(Boolean);

    const updateActiveLink = () => {
        const cur = window.scrollY + 150;
        for (let i = sections.length - 1; i >= 0; i--) {
            if (cur >= sections[i].offsetTop) {
                const id = '#' + sections[i].id;
                navLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === id));
                return;
            }
        }
    };

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    window.addEventListener('load', updateActiveLink);

    /* ---------- Reduced motion / no GSAP — bail early ---------- */
    if (!hasGSAP || reduceMotion) {
        document.querySelectorAll('.hero-image img').forEach((el) => {
            el.style.clipPath = 'inset(0)';
        });

        // Hide loader instantly — no 2s wait for users who opted out of motion
        const loaderEl = document.getElementById('loader');
        if (loaderEl) loaderEl.classList.add('is-hidden');
        document.body.classList.remove('is-loading');

        // Progress bar fallback — GSAP won't run, so update directly
        // on scroll. No easing/scrub, but functional and honest.
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

        return;
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
        /* After intro completes, recalc ScrollTrigger positions —
           otherwise triggers created during load may be offset by
           the intro's initial .from() states. */
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
    ========================================================= */
    document.querySelectorAll('.section-head h2').forEach((h2) => {
        const words = splitWords(h2);
        if (!words.length) return;

        gsap.set(words, { y: 30, opacity: 0, rotate: 2 });

        ScrollTrigger.create({
            trigger: h2,
            start: 'top 85%',
            once: true,
            onEnter: () => {
                gsap.to(words, {
                    y: 0,
                    opacity: 1,
                    rotate: 0,
                    duration: 1.05,       // was 0.85 — slower = more elegant
                    ease: 'power3.out',   // smoother than expo for word-by-word
                    stagger: 0.09         // was 0.06 — wider gap between words
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
                rotX(-y * 11);   // was 8 — more visible tilt
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
            // elastic.out(amplitude, period):
            //   period 0.3 (was 0.4)  -> faster oscillation -> bouncier return
            //   duration 0.7 (was 0.6) -> give the spring time to settle
            const xTo = gsap.quickTo(btn, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.3)' });
            const yTo = gsap.quickTo(btn, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.3)' });

            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                // Pull 0.42 (was 0.35) -> more travel toward the cursor
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
       GENERIC REVEALS
    ========================================================= */
    const reveal = (selector, opts = {}) => {
        gsap.utils.toArray(selector).forEach((el) => {
            gsap.from(el, {
                y: opts.y ?? 40,
                opacity: 0,
                duration: opts.duration ?? 0.9,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: opts.start ?? 'top 88%',
                    once: true
                }
            });
        });
    };

    reveal('.about-text');
    reveal('.skill-tag', { y: 20, duration: 0.6 });
    reveal('.project-card', { y: 50, duration: 1 });
    reveal('.cert-card', { y: 40, duration: 0.8 });
    reveal('#contact-text');
    reveal('.contact-links .btn', { y: 20, duration: 0.6 });

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
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: {
                trigger: footerEl,
                start: 'top 95%',
                once: true
            }
        });
    }

    /* Scroll progress bar */
    const progressBar = document.querySelector('.scroll-progress');
    if (progressBar) {
        gsap.to(progressBar, {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: 0.3 }
        });
    }

    /* Refresh after fonts load */
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
    window.addEventListener('load', () => ScrollTrigger.refresh());
})();