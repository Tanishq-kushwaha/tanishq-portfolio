/* =========================================================
   js/script.js
   Portfolio UI + GSAP animations.

   Changes vs previous version:
   - Theme set ho raha hai <html> par (documentElement) — flash prevention
   - Har theme change par `themechange` CustomEvent dispatch hota hai (background.js sunta hai)
   - Magnetic button pull thoda kam, duration thoda smooth

   Features:
   - Sticky header + active nav link
   - Dark / Light theme (localStorage)
   - Typed name + rotating roles
   - Mobile hamburger menu
   - GSAP Core + ScrollTrigger animations
   - IntersectionObserver fallback (agar GSAP load na ho)
   - prefers-reduced-motion support
========================================================= */

(function () {
    'use strict';

    /* -----------------------------------------------------
       1. Capability detection
    ----------------------------------------------------- */
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    const gsapReady = !!gsap;
    const scrollTriggerReady = gsapReady && !!ScrollTrigger;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (scrollTriggerReady) {
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
    }

    // Safe localStorage wrapper
    const storage = {
        get(key) {
            try { return window.localStorage.getItem(key); } catch (err) { return null; }
        },
        set(key, value) {
            try { window.localStorage.setItem(key, value); } catch (err) { /* ignore */ }
        }
    };

    /* -----------------------------------------------------
       2. Sticky header
    ----------------------------------------------------- */
    const header = document.querySelector('header');
    const syncHeader = () => header.classList.toggle('sticky', window.scrollY > 0);
    window.addEventListener('scroll', syncHeader, { passive: true });
    syncHeader();

    /* -----------------------------------------------------
       3. Theme toggle
       - Attribute <html> par set hota hai (head script flash rokta hai)
       - CustomEvent `themechange` dispatch hota hai taaki background.js update ho
    ----------------------------------------------------- */
    const themeBtn = document.getElementById('theme-toggle');
    const rootElement = document.documentElement;

    const setTheme = (theme) => {
        const isDark = theme === 'dark';

        if (isDark) {
            rootElement.setAttribute('data-theme', 'dark');
            themeBtn.textContent = '☀️ Light Mode';
            storage.set('theme', 'dark');
        } else {
            rootElement.removeAttribute('data-theme');
            themeBtn.textContent = '🌙 Dark Mode';
            storage.set('theme', 'light');
        }

        // Background ko batayein theme change hui
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: isDark ? 'dark' : 'light' }
        }));
    };

    setTheme(storage.get('theme') || 'light');

    themeBtn.addEventListener('click', () => {
        const isDark = rootElement.getAttribute('data-theme') === 'dark';
        setTheme(isDark ? 'light' : 'dark');
    });

    /* -----------------------------------------------------
       4. Hero typed name + rotating roles
    ----------------------------------------------------- */
    const nameElement = document.getElementById('typed-name');
    const roleElement = document.getElementById('dynamic-role');
    const fullName = 'Tanishq Kushwaha';
    const roles = ['Junior Software Developer', 'Frontend Developer', 'Problem Solver'];

    let nameIndex = 0;
    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingStarted = false;

    function typeName() {
        if (nameIndex < fullName.length) {
            nameElement.textContent += fullName.charAt(nameIndex);
            nameIndex += 1;
            window.setTimeout(typeName, 120);
        } else {
            window.setTimeout(startDynamicRoles, 500);
        }
    }

    function startDynamicRoles() {
        const currentRole = roles[roleIndex];

        if (isDeleting) {
            roleElement.textContent = currentRole.substring(0, charIndex - 1);
            charIndex -= 1;
        } else {
            roleElement.textContent = currentRole.substring(0, charIndex + 1);
            charIndex += 1;
        }

        let typeSpeed = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentRole.length) {
            typeSpeed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            typeSpeed = 500;
        }

        window.setTimeout(startDynamicRoles, typeSpeed);
    }

    function startTypingOnce() {
        if (typingStarted) return;
        typingStarted = true;
        typeName();
    }

    if (prefersReducedMotion) {
        // Reduced motion: typing skip, final text
        nameElement.textContent = fullName;
        roleElement.textContent = roles[0];
    } else {
        // Fallback: agar GSAP fail ho to load par 900ms baad start
        window.addEventListener('load', () => window.setTimeout(startTypingOnce, 900));
    }

    /* -----------------------------------------------------
       5. Mobile navigation
    ----------------------------------------------------- */
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links a').forEach((link) => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    /* -----------------------------------------------------
       6. Active nav link on scroll
    ----------------------------------------------------- */
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = Array.from(navLinks)
        .map((link) => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);

    function updateActiveLink() {
        const offset = 150;
        const current = window.scrollY + offset;
        let found = false;

        for (let i = sections.length - 1; i >= 0; i -= 1) {
            const section = sections[i];
            if (!section) continue;
            if (current >= section.offsetTop) {
                const id = `#${section.id}`;
                navLinks.forEach((link) => {
                    link.classList.toggle('active', link.getAttribute('href') === id);
                });
                found = true;
                break;
            }
        }

        if (!found) {
            navLinks.forEach((link) => link.classList.remove('active'));
        }
    }

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    window.addEventListener('load', updateActiveLink);
    window.addEventListener('hashchange', updateActiveLink);

    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            navLinks.forEach((l) => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    /* -----------------------------------------------------
       7. Fallback reveals (jab GSAP available na ho)
    ----------------------------------------------------- */
    function initCardFallback() {
        const revealElements = document.querySelectorAll('.project-card, .cert-card');
        if (!revealElements.length) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            revealElements.forEach((el) => el.classList.add('reveal-card', 'visible'));
            return;
        }

        revealElements.forEach((el, i) => {
            el.classList.add('reveal-card');
            el.style.transitionDelay = `${i * 120}ms`;
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                entry.target.classList.toggle('visible', entry.isIntersecting);
            });
        }, {
            root: null,
            rootMargin: '0px 0px -80px 0px',
            threshold: 0.12
        });

        revealElements.forEach((el) => observer.observe(el));
    }

    /* -----------------------------------------------------
       8. GSAP Motion Layer
    ----------------------------------------------------- */
    function initMotion() {
        if (!gsapReady || !scrollTriggerReady) {
            initCardFallback();
            return;
        }

        // CSS scroll-timeline hata do — GSAP control lega
        document.querySelectorAll('.autoshow').forEach((el) => el.classList.remove('autoshow'));

        if (prefersReducedMotion) return;

        const mm = gsap.matchMedia();

        mm.add(
            {
                motionOk: '(prefers-reduced-motion: no-preference)',
                isDesktop: '(min-width: 769px)',
                isFinePointer: '(hover: hover) and (pointer: fine)'
            },
            (context) => {
                const { motionOk, isDesktop, isFinePointer } = context.conditions;
                if (!motionOk) return;

                const cleanups = [];
                const distance = isDesktop ? 36 : 22;

                /* Helper: reveal with hover-safe transform clearing */
                const fromReveal = (targets, fromVars, scrollTriggerVars) => {
                    const elements = gsap.utils.toArray(targets);
                    if (!elements.length) return;

                    elements.forEach((el) => el.classList.add('animating-gsap'));

                    const vars = Object.assign({}, fromVars, {
                        clearProps: 'transform',
                        onComplete: () => {
                            elements.forEach((el) => el.classList.remove('animating-gsap'));
                        }
                    });

                    if (scrollTriggerVars) {
                        vars.scrollTrigger = scrollTriggerVars;
                    }

                    gsap.from(elements, vars);
                };

                /* ----- Navigation entrance ----- */
                gsap.from('.left', {
                    y: -16,
                    opacity: 0,
                    duration: 0.55,
                    ease: 'power3.out',
                    clearProps: 'transform'
                });

                gsap.from('.nav-links li', {
                    y: -14,
                    opacity: 0,
                    duration: 0.5,
                    stagger: 0.06,
                    delay: 0.12,
                    ease: 'power3.out',
                    clearProps: 'transform'
                });

                /* ----- Hero timeline ----- */
                const heroButtons = gsap.utils.toArray('.hero-buttons .btn');
                heroButtons.forEach((btn) => btn.classList.add('animating-gsap'));

                const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

                heroTl
                    .from('.hero-content h1', {
                        y: 40,
                        opacity: 0,
                        duration: 0.85,
                        ease: 'power4.out'
                    }, 0.08)
                    .from('.dynamic-text', {
                        y: 20,
                        opacity: 0,
                        duration: 0.65
                    }, 0.55)
                    .from('.hero-image', {
                        opacity: 0,
                        scale: 0.88,
                        y: 28,
                        duration: 1.05
                    }, 0.28)
                    .from('.hero-orbit', {
                        opacity: 0,
                        duration: 0.8
                    }, 0.6)
                    .from(heroButtons, {
                        y: 22,
                        opacity: 0,
                        duration: 0.6,
                        stagger: 0.1,
                        clearProps: 'transform',
                        onComplete: () => {
                            heroButtons.forEach((btn) => btn.classList.remove('animating-gsap'));
                        }
                    }, 0.7)
                    .call(startTypingOnce, null, 0.85);

                /* ----- Desktop-only: parallax + pointer tilt ----- */
                if (isDesktop) {
                    gsap.to('.hero-image', {
                        yPercent: 10,
                        ease: 'none',
                        scrollTrigger: {
                            trigger: '#home',
                            start: 'top top',
                            end: 'bottom top',
                            scrub: 0.7
                        }
                    });

                    const heroImage = document.querySelector('.hero-image');
                    const heroSection = document.querySelector('#home');

                    if (heroImage && heroSection && isFinePointer) {
                        const xTo = gsap.quickTo(heroImage, 'x', { duration: 0.55, ease: 'power3' });
                        const yTo = gsap.quickTo(heroImage, 'y', { duration: 0.55, ease: 'power3' });
                        const rotateXTo = gsap.quickTo(heroImage, 'rotationX', { duration: 0.55, ease: 'power3' });
                        const rotateYTo = gsap.quickTo(heroImage, 'rotationY', { duration: 0.55, ease: 'power3' });

                        const handlePointerMove = (event) => {
                            const rect = heroImage.getBoundingClientRect();
                            const relX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
                            const relY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
                            xTo(relX * 10);
                            yTo(relY * 10);
                            rotateXTo(-relY * 6);
                            rotateYTo(relX * 6);
                        };

                        const resetTilt = () => {
                            xTo(0); yTo(0); rotateXTo(0); rotateYTo(0);
                        };

                        heroSection.addEventListener('pointermove', handlePointerMove);
                        heroSection.addEventListener('pointerleave', resetTilt);

                        cleanups.push(() => {
                            heroSection.removeEventListener('pointermove', handlePointerMove);
                            heroSection.removeEventListener('pointerleave', resetTilt);
                        });
                    }
                }

                /* ----- Magnetic buttons (desktop + fine pointer) ----- */
                if (isDesktop && isFinePointer) {
                    const magneticTargets = gsap.utils.toArray('.hero-buttons .btn, .contact-links .btn');
                    magneticTargets.forEach((btn) => {
                        const xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
                        const yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });

                        const onMove = (e) => {
                            const rect = btn.getBoundingClientRect();
                            const relX = e.clientX - (rect.left + rect.width / 2);
                            const relY = e.clientY - (rect.top + rect.height / 2);
                            // 0.2 = 20% pull; badhana ho to 0.3+ kar do
                            xTo(relX * 0.2);
                            yTo(relY * 0.2);
                        };

                        const onLeave = () => {
                            xTo(0);
                            yTo(0);
                        };

                        btn.addEventListener('pointermove', onMove);
                        btn.addEventListener('pointerleave', onLeave);

                        cleanups.push(() => {
                            btn.removeEventListener('pointermove', onMove);
                            btn.removeEventListener('pointerleave', onLeave);
                            gsap.set(btn, { x: 0, y: 0 });
                        });
                    });
                }

                /* ----- About ----- */
                fromReveal('#about h2', { y: distance, opacity: 0, duration: 0.75 }, {
                    trigger: '#about', start: 'top 80%'
                });
                fromReveal('.about-text', { y: distance, opacity: 0, duration: 0.85 }, {
                    trigger: '.about-text', start: 'top 86%'
                });
                fromReveal('.skill-tag', {
                    y: 20, opacity: 0, scale: 0.94, duration: 0.5, stagger: 0.055, ease: 'power2.out'
                }, {
                    trigger: '.skills-container', start: 'top 90%'
                });

                /* ----- Projects ----- */
                fromReveal('#projects h2', { y: distance, opacity: 0, duration: 0.75 }, {
                    trigger: '#projects', start: 'top 80%'
                });
                fromReveal('.project-card', {
                    y: distance + 8, opacity: 0, scale: 0.96, duration: 0.75, stagger: 0.12
                }, {
                    trigger: '.projects-grid', start: 'top 86%'
                });

                /* ----- Certifications ----- */
                fromReveal('#certificates h2', { y: distance, opacity: 0, duration: 0.75 }, {
                    trigger: '#certificates', start: 'top 80%'
                });
                fromReveal('.cert-card', {
                    y: distance + 6, opacity: 0, scale: 0.96, duration: 0.7, stagger: 0.11
                }, {
                    trigger: '.certificates-grid', start: 'top 86%'
                });

                /* ----- Contact ----- */
                fromReveal('#contact h2', { y: distance, opacity: 0, duration: 0.75 }, {
                    trigger: '#contact', start: 'top 80%'
                });
                fromReveal('#contact-text', { y: distance, opacity: 0, duration: 0.85 }, {
                    trigger: '#contact-text', start: 'top 88%'
                });
                fromReveal('.contact-links .btn', {
                    y: 20, opacity: 0, duration: 0.55, stagger: 0.09, ease: 'power2.out'
                }, {
                    trigger: '.contact-links', start: 'top 90%'
                });

                /* ----- Footer ----- */
                fromReveal('.footer-brand, .footer-copyright, .footer-status', {
                    y: 24, opacity: 0, duration: 0.65, stagger: 0.1, ease: 'power2.out'
                }, {
                    trigger: '.premium-footer', start: 'top 94%'
                });

                /* ----- Scroll progress ----- */
                if (document.querySelector('.scroll-progress')) {
                    gsap.to('.scroll-progress', {
                        scaleX: 1,
                        ease: 'none',
                        scrollTrigger: { start: 0, end: 'max', scrub: 0.25 }
                    });
                }

                return () => {
                    cleanups.forEach((fn) => fn());
                    document.querySelectorAll('.animating-gsap').forEach((el) => {
                        el.classList.remove('animating-gsap');
                    });
                };
            }
        );
    }

    /* -----------------------------------------------------
   8b. Pointer Effects (Cursor glow + Background parallax)
   
   Sirf desktop + mouse wale devices par chalta hai.
   Touch phones / tablets / reduced-motion — sab skip.
   
   Do effects ek saath:
     1. .cursor-glow div cursor ko smoothly follow karta hai
     2. .bg-layer cursor ke OPPOSITE direction mein halke se shift hota hai
----------------------------------------------------- */
    function initPointerEffects() {
        // Sirf desktop + mouse check
        const isDesktopWithMouse = window.matchMedia(
            '(hover: hover) and (pointer: fine)'
        ).matches;

        // Accessibility — reduced motion check
        const prefersReduced = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;

        // Koi bhi condition fail ho to kuch mat karo
        if (!isDesktopWithMouse || prefersReduced || !gsapReady) {
            return function noop() { /* nothing */ };
        }

        const glowEl = document.querySelector('.cursor-glow');
        const bgEl = document.querySelector('.bg-layer');

        /* ---- Part A: Cursor glow follower ---- */
        let onGlowMove = null;
        let onGlowLeave = null;

        if (glowEl) {
            // quickTo = ek hi tween ko retarget karta hai (1000x faster than gsap.to per move)
            const glowXTo = gsap.quickTo(glowEl, 'x', { duration: 0.35, ease: 'power2.out' });
            const glowYTo = gsap.quickTo(glowEl, 'y', { duration: 0.35, ease: 'power2.out' });

            onGlowMove = function (event) {
                document.body.classList.add('cursor-active');
                glowXTo(event.clientX);
                glowYTo(event.clientY);
            };

            onGlowLeave = function () {
                document.body.classList.remove('cursor-active');
            };

            window.addEventListener('pointermove', onGlowMove, { passive: true });
            document.documentElement.addEventListener('pointerleave', onGlowLeave);
        }

        /* ---- Part B: Background parallax ---- */
        let onBgMove = null;

        if (bgEl) {
            const MAX_OFFSET = 14;   // 8-25 ke beech rakhna — zyada = zyada movement

            const bgXTo = gsap.quickTo(bgEl, 'x', { duration: 1.4, ease: 'power2.out' });
            const bgYTo = gsap.quickTo(bgEl, 'y', { duration: 1.4, ease: 'power2.out' });

            onBgMove = function (event) {
                // Cursor ki screen-center se doori, -1 se +1 range
                const relX = (event.clientX / window.innerWidth - 0.5) * 2;
                const relY = (event.clientY / window.innerHeight - 0.5) * 2;

                // MINUS = opposite direction (cursor right → bg left)
                bgXTo(-relX * MAX_OFFSET);
                bgYTo(-relY * MAX_OFFSET);
            };

            window.addEventListener('pointermove', onBgMove, { passive: true });
        }

        /* ---- Cleanup function ---- */
        return function cleanup() {
            if (onGlowMove) window.removeEventListener('pointermove', onGlowMove);
            if (onGlowLeave) document.documentElement.removeEventListener('pointerleave', onGlowLeave);
            if (onBgMove) window.removeEventListener('pointermove', onBgMove);
            document.body.classList.remove('cursor-active');
            if (bgEl) gsap.set(bgEl, { x: 0, y: 0 });
        };
    }

    /* -----------------------------------------------------
       9. Boot
    ----------------------------------------------------- */
    initMotion();


    // Media query change par automatically on/off ho jayen
    // (desktop ↔ mobile resize, reduced-motion toggle, etc.)
    (function managePointerEffectsLifecycle() {
        let activeCleanup = null;

        const mediaQuery = window.matchMedia(
            '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
        );

        const activate = () => {
            if (activeCleanup) return;
            activeCleanup = initPointerEffects();
        };

        const deactivate = () => {
            if (activeCleanup) {
                activeCleanup();
                activeCleanup = null;
            }
        };

        if (mediaQuery.matches) activate();

        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', (e) => {
                if (e.matches) activate();
                else deactivate();
            });
        } else if (mediaQuery.addListener) {
            // Purani Safari fallback
            mediaQuery.addListener((e) => {
                if (e.matches) activate();
                else deactivate();
            });
        }
    })();

    window.addEventListener('load', () => {
        if (scrollTriggerReady && !prefersReducedMotion) {
            ScrollTrigger.refresh();
        }
    });

    if (scrollTriggerReady && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (!prefersReducedMotion) ScrollTrigger.refresh();
        });
    }
})();