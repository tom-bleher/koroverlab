// Mobile menu.
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("nav");
toggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});

// Header: full size at the top of the page, compact once the reader scrolls.
const header = document.querySelector(".site-header");
const compact = () => header.classList.toggle("compact", scrollY > 40);
addEventListener("scroll", compact, { passive: true });
compact();
