/* =========================================================
   script.js — Advanced motion layer
   Custom cursor • split reveals • marquee • 3D tilt • skew
========================================================= */
(function () {
    'use strict';

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
        document.querySelectorAll('.hero-image img').forEach((el) => { el.style.clipPath = 'inset(0)'; });
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
       CUSTOM CURSOR
    ========================================================= */
    if (isFine) {
        const dot = document.querySelector('.cursor-dot');
        const ring = document.querySelector('.cursor-ring');

        if (dot && ring) {
            const dotX = gsap.quickTo(dot, 'x', { duration: 0.15, ease: 'power3' });
            const dotY = gsap.quickTo(dot, 'y', { duration: 0.15, ease: 'power3' });
            const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
            const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });

            window.addEventListener('pointermove', (e) => {
                dotX(e.clientX); dotY(e.clientY);
                ringX(e.clientX); ringY(e.clientY);
            });

            document.querySelectorAll(
                'a, button, .project-card, .cert-card, .skill-tag, .hero-image'
            ).forEach((el) => {
                el.addEventListener('pointerenter', () => ring.classList.add('hover'));
                el.addEventListener('pointerleave', () => ring.classList.remove('hover'));
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

    const introTl = gsap.timeline({ defaults: { ease: 'power4.out' } });

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
        }, 0.9);

    /* ----- Hero image — soft continuous float -----
Animates the inner <img>, NOT the .hero-image wrapper.
Why: the pointer-tilt targets .hero-image (x/y/rotation),
and the scroll parallax targets .hero-image (yPercent).
Floating the inner img keeps all three independent.

delay 1.8s = waits for the intro clip-reveal to finish
(clip reveal ends at ~1.7s) so we don't fight the intro. */
    gsap.to('.hero-image img', {
        y: -14,
        duration: 3.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 1.8
    });

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
                    duration: 0.85,
                    ease: 'expo.out',
                    stagger: 0.06
                });
            }
        });
    });

    /* =========================================================
       MARQUEE
    ========================================================= */
    const marqueeTrack = document.querySelector('.marquee-track');
    if (marqueeTrack) {
        const clone = marqueeTrack.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        marqueeTrack.parentNode.appendChild(clone);

        gsap.to([marqueeTrack, clone], {
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
                rotX(-y * 8);
                rotY(x * 8);
            });
            card.addEventListener('pointerleave', () => { rotX(0); rotY(0); });
        });
    }

    /* =========================================================
       ELASTIC MAGNETIC BUTTONS
    ========================================================= */
    if (isFine) {
        document.querySelectorAll('.btn, .btn-small').forEach((btn) => {
            const xTo = gsap.quickTo(btn, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
            const yTo = gsap.quickTo(btn, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });

            btn.addEventListener('pointermove', (e) => {
                const r = btn.getBoundingClientRect();
                xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
                yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
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
    reveal('.footer-container > *', { y: 30, duration: 0.7 });

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