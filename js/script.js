/* =========================================================
   js/script.js
   Portfolio interactions + GSAP animations
   
   Features:
   - Sticky header + active nav link
   - Dark / Light theme (localStorage)
   - Typed name + rotating roles
   - Mobile hamburger menu
   - GSAP Core + ScrollTrigger animations
   - Fallback (IntersectionObserver) agar GSAP load na ho
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
        // Mobile URL bar hide/show pe unnecessary refresh mat lo
        ScrollTrigger.config({ ignoreMobileResize: true });
    }

    // Safe localStorage (private mode me error na aaye)
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
       3. Theme toggle (Dark / Light)
    ----------------------------------------------------- */
    const themeBtn = document.getElementById('theme-toggle');
    const body = document.body;

    const setTheme = (theme) => {
        if (theme === 'dark') {
            body.setAttribute('data-theme', 'dark');
            themeBtn.textContent = '☀️ Light Mode';
            storage.set('theme', 'dark');
        } else {
            body.removeAttribute('data-theme');
            themeBtn.textContent = '🌙 Dark Mode';
            storage.set('theme', 'light');
        }
    };

    // Page load pe saved theme apply karo
    setTheme(storage.get('theme') || 'light');

    themeBtn.addEventListener('click', () => {
        const isDark = body.getAttribute('data-theme') === 'dark';
        setTheme(isDark ? 'light' : 'dark');
    });

    /* -----------------------------------------------------
       4. Hero – Typed name + rotating roles
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
            typeSpeed = 2000;          // pause before delete
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
            typeSpeed = 500;           // small pause before next role
        }

        window.setTimeout(startDynamicRoles, typeSpeed);
    }

    function startTypingOnce() {
        if (typingStarted) return;
        typingStarted = true;
        typeName();
    }

    // Reduced motion: typing skip, final text dikhao
    if (prefersReducedMotion) {
        nameElement.textContent = fullName;
        roleElement.textContent = roles[0];
    } else {
        window.addEventListener('load', () => window.setTimeout(startTypingOnce, 900));
    }

    /* -----------------------------------------------------
       5. Mobile navigation (hamburger)
    ----------------------------------------------------- */
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Link click pe menu band karo
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
       8. GSAP Motion Layer (Core + ScrollTrigger only)
    ----------------------------------------------------- */
    function initMotion() {
        // GSAP nahi mila to fallback chalao
        if (!gsapReady || !scrollTriggerReady) {
            initCardFallback();
            return;
        }

        // CSS scroll-timeline hata do (GSAP control lega)
        document.querySelectorAll('.autoshow').forEach((el) => el.classList.remove('autoshow'));

        // Reduced motion: koi animation mat chalao
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
                const distance = isDesktop ? 36 : 22; // mobile pe chhota distance

                /* Helper: elements ko reveal karo + hover ke liye transform clear karo */
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
                        duration: 1.05,
                        ease: 'power3.out'
                    }, 0.28)
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

                /* Desktop only: parallax + pointer tilt on photo */
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
                            xTo(relX * 12);
                            yTo(relY * 12);
                            rotateXTo(-relY * 7);
                            rotateYTo(relX * 7);
                        };

                        const resetTilt = () => {
                            xTo(0);
                            yTo(0);
                            rotateXTo(0);
                            rotateYTo(0);
                        };

                        heroSection.addEventListener('pointermove', handlePointerMove);
                        heroSection.addEventListener('pointerleave', resetTilt);

                        cleanups.push(() => {
                            heroSection.removeEventListener('pointermove', handlePointerMove);
                            heroSection.removeEventListener('pointerleave', resetTilt);
                        });
                    }
                }

                /* Magnetic buttons – sirf desktop + fine pointer */
                if (isDesktop && isFinePointer) {
                    const magneticTargets = gsap.utils.toArray('.hero-buttons .btn, .contact-links .btn');
                    magneticTargets.forEach((btn) => {
                        const xTo = gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3' });
                        const yTo = gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3' });

                        const onMove = (e) => {
                            const rect = btn.getBoundingClientRect();
                            const relX = e.clientX - (rect.left + rect.width / 2);
                            const relY = e.clientY - (rect.top + rect.height / 2);
                            xTo(relX * 0.28);
                            yTo(relY * 0.28);
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

                /* ----- About section ----- */
                fromReveal('#about h2', {
                    y: distance,
                    opacity: 0,
                    duration: 0.75,
                    ease: 'power3.out'
                }, {
                    trigger: '#about',
                    start: 'top 80%'
                });

                fromReveal('.about-text', {
                    y: distance,
                    opacity: 0,
                    duration: 0.85,
                    ease: 'power3.out'
                }, {
                    trigger: '.about-text',
                    start: 'top 86%'
                });

                fromReveal('.skill-tag', {
                    y: 20,
                    opacity: 0,
                    scale: 0.94,
                    duration: 0.5,
                    stagger: 0.055,
                    ease: 'power2.out'
                }, {
                    trigger: '.skills-container',
                    start: 'top 90%'
                });

                /* ----- Projects section ----- */
                fromReveal('#projects h2', {
                    y: distance,
                    opacity: 0,
                    duration: 0.75,
                    ease: 'power3.out'
                }, {
                    trigger: '#projects',
                    start: 'top 80%'
                });

                fromReveal('.project-card', {
                    y: distance + 8,
                    opacity: 0,
                    scale: 0.96,
                    duration: 0.75,
                    stagger: 0.12,
                    ease: 'power3.out'
                }, {
                    trigger: '.projects-grid',
                    start: 'top 86%'
                });

                /* ----- Certifications section ----- */
                fromReveal('#certificates h2', {
                    y: distance,
                    opacity: 0,
                    duration: 0.75,
                    ease: 'power3.out'
                }, {
                    trigger: '#certificates',
                    start: 'top 80%'
                });

                fromReveal('.cert-card', {
                    y: distance + 6,
                    opacity: 0,
                    scale: 0.96,
                    duration: 0.7,
                    stagger: 0.11,
                    ease: 'power3.out'
                }, {
                    trigger: '.certificates-grid',
                    start: 'top 86%'
                });

                /* ----- Contact section ----- */
                fromReveal('#contact h2', {
                    y: distance,
                    opacity: 0,
                    duration: 0.75,
                    ease: 'power3.out'
                }, {
                    trigger: '#contact',
                    start: 'top 80%'
                });

                fromReveal('#contact-text', {
                    y: distance,
                    opacity: 0,
                    duration: 0.85,
                    ease: 'power3.out'
                }, {
                    trigger: '#contact-text',
                    start: 'top 88%'
                });

                fromReveal('.contact-links .btn', {
                    y: 20,
                    opacity: 0,
                    duration: 0.55,
                    stagger: 0.09,
                    ease: 'power2.out'
                }, {
                    trigger: '.contact-links',
                    start: 'top 90%'
                });

                /* ----- Footer ----- */
                fromReveal('.footer-brand, .footer-copyright, .footer-status', {
                    y: 24,
                    opacity: 0,
                    duration: 0.65,
                    stagger: 0.1,
                    ease: 'power2.out'
                }, {
                    trigger: '.premium-footer',
                    start: 'top 94%'
                });

                /* ----- Scroll progress bar ----- */
                if (document.querySelector('.scroll-progress')) {
                    gsap.to('.scroll-progress', {
                        scaleX: 1,
                        ease: 'none',
                        scrollTrigger: {
                            start: 0,
                            end: 'max',
                            scrub: 0.25
                        }
                    });
                }

                /* Cleanup jab media query change ho */
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
       9. Boot – animations start
    ----------------------------------------------------- */
    initMotion();

    window.addEventListener('load', () => {
        if (scrollTriggerReady && !prefersReducedMotion) {
            ScrollTrigger.refresh();
        }
    });

    // Fonts load hone ke baad positions refresh karo
    if (scrollTriggerReady && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (!prefersReducedMotion) ScrollTrigger.refresh();
        });
    }
})();