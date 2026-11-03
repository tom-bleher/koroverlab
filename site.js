// Mobile menu.
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("nav");
toggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});

// Home page: the hero images advance by themselves; swipe or scroll to move by hand.
const slides = document.querySelector(".slides");
if (slides && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  setInterval(() => {
    if (document.hidden || slides.matches(":hover")) return;
    const count = slides.children.length;
    const at = Math.round(slides.scrollLeft / slides.clientWidth);
    slides.scrollTo({ left: ((at + 1) % count) * slides.clientWidth, behavior: "smooth" });
  }, 6000);
}
