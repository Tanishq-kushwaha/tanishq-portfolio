window.addEventListener("scroll", () => {
    const header = document.querySelector("header");
    header.classList.toggle("sticky", window.scrollY > 0);
});

const themeBtn = document.getElementById('theme-toggle');
const body = document.body;

const setTheme = (theme) => {
    if (theme === 'light') {
        body.setAttribute('data-theme', 'light');
        themeBtn.textContent = '🌙 Dark Mode';
        localStorage.setItem('theme', 'light');
    } else {
        body.removeAttribute('data-theme');
        themeBtn.textContent = '☀️ Light Mode';
        localStorage.setItem('theme', 'dark');
    }
};

const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    setTheme(savedTheme);
}

themeBtn.addEventListener('click', () => {
    const isCurrentlyLight = body.getAttribute('data-theme') === 'light';
    setTheme(isCurrentlyLight ? 'dark' : 'light');
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
const roles = ["Junior Software Developer", "Frontend Developer", "Logic Builder", "Problem Solver"];
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