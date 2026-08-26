window.addEventListener("scroll", () => {
    const header = document.querySelector("header");
    header.classList.toggle("sticky", window.scrollY > 0);
});



const themeBtn = document.getElementById('theme-toggle');
const body = document.body;

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

// Agar koi data nahi hai, toh default 'light' select hoga
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

themeBtn.addEventListener('click', () => {
    const isCurrentlyDark = body.getAttribute('data-theme') === 'dark';
    setTheme(isCurrentlyDark ? 'light' : 'dark');
});


const nameElement = document.getElementById('typed-name');
const myName = "Tanishq Kushwaha";
let nameIndex = 0;

function typeName() {
    if (nameIndex < myName.length) {
        nameElement.textContent += myName.charAt(nameIndex);
        nameIndex++;
        setTimeout(typeName, 120);
    } else {
        setTimeout(startDynamicRoles, 500);
    }
}

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
        typeSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        typeSpeed = 500;
    }

    setTimeout(startDynamicRoles, typeSpeed);
}

window.onload = () => {
    setTimeout(typeName, 500);
};

const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-menu');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});


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