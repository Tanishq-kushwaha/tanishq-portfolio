/* js/script.js
   Handles UI interactions for the portfolio:
   - sticky header on scroll
   - theme toggle (light/dark) persisted in localStorage
   - typed name + rotating role text in hero
   - mobile hamburger toggle and nav link highlighting
   - reveal animations for project/certificate cards (IntersectionObserver)
*/

// Sticky header: toggles `header.sticky` when the page is scrolled
window.addEventListener("scroll", () => {
    const header = document.querySelector("header");
    header.classList.toggle("sticky", window.scrollY > 0);
});



// Theme toggle elements: button and document body
const themeBtn = document.getElementById('theme-toggle');
const body = document.body;

/**
 * Set the theme for the page.
 * - 'dark' applies `data-theme="dark"` to the <body>
 * - otherwise removes the attribute for light theme
 * Stores choice in localStorage so preference persists.
 */
const setTheme = (theme) => {
    if (theme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeBtn.textContent = '☀️ Light Mode';
        localStorage.setItem('theme', 'dark');
    } else {
        body.removeAttribute('data-theme');
        themeBtn.textContent = '🌙 Dark Mode';
        localStorage.setItem('theme', 'light');
    }
};

// Load saved theme (fallback to 'light')
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

// Toggle theme on button click
themeBtn.addEventListener('click', () => {
    const isCurrentlyDark = body.getAttribute('data-theme') === 'dark';
    setTheme(isCurrentlyDark ? 'light' : 'dark');
});


// Typed name effect in hero
const nameElement = document.getElementById('typed-name');
const myName = "Tanishq Kushwaha";
let nameIndex = 0;

function typeName() {
    if (nameIndex < myName.length) {
        nameElement.textContent += myName.charAt(nameIndex);
        nameIndex++;
        setTimeout(typeName, 120);
    } else {
        // Start role rotation after name is typed
        setTimeout(startDynamicRoles, 500);
    }
}

// Rotating role text under the name (type + delete animation)
const roleElement = document.getElementById('dynamic-role');
const roles = ["Junior Software Developer", "Frontend Developer", "Problem Solver"];
let roleIndex = 0;
let charIndex = 0;
let isDeleting = false;

function startDynamicRoles() {
    const currentRole = roles[roleIndex];

    if (isDeleting) {
        roleElement.textContent = currentRole.substring(0, charIndex - 1);
        charIndex--;
    } else {
        roleElement.textContent = currentRole.substring(0, charIndex + 1);
        charIndex++;
    }

    let typeSpeed = isDeleting ? 50 : 100;

    if (!isDeleting && charIndex === currentRole.length) {
        typeSpeed = 2000; // pause before deleting
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        typeSpeed = 500; // small pause before typing next
    }

    setTimeout(startDynamicRoles, typeSpeed);
}

// Kick off hero typing after page load
window.onload = () => {
    setTimeout(typeName, 500);
};

// Mobile hamburger toggle: opens/closes the right-hand nav menu
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile nav when any nav link is clicked
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Active nav link highlight based on scroll position and clicks
const navLinks = document.querySelectorAll('.nav-links a');
const sections = Array.from(navLinks)
    .map(link => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

function updateActiveLink() {
    const offset = 150; // adjust for header height
    const current = window.scrollY + offset;

    // Find the last section above the current scroll position
    let found = false;
    for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        if (!sec) continue;
        const top = sec.offsetTop;
        if (current >= top) {
            const id = '#' + sec.id;
            navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === id));
            found = true;
            break;
        }
    }

    if (!found) {
        navLinks.forEach(link => link.classList.remove('active'));
    }
}

window.addEventListener('scroll', updateActiveLink);
window.addEventListener('load', updateActiveLink);
window.addEventListener('hashchange', updateActiveLink);

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});


/* Reveal scroll-up animation for project + cert cards */
(function () {
    const revealSelector = '.project-card, .cert-card';
    const revealElements = document.querySelectorAll(revealSelector);
    if (!revealElements.length) return;

    // Respect reduced motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revealElements.forEach(el => el.classList.add('reveal-card', 'visible'));
        return;
    }

    // Prepare elements with initial hidden state and staggered delays
    revealElements.forEach((el, i) => {
        el.classList.add('reveal-card');
        el.style.transitionDelay = `${i * 120}ms`;
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            } else {
                entry.target.classList.remove('visible');
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -80px 0px',
        threshold: 0.12
    });

    revealElements.forEach(el => observer.observe(el));
})();