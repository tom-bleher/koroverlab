// Mobile menu.
const toggle = document.querySelector(".menu-toggle");
const nav = document.getElementById("nav");
toggle?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  toggle.setAttribute("aria-expanded", open);
});

// Home page: the hero images scroll by themselves, and by swipe or the arrows.
const slides = document.querySelector(".slides");
if (slides) {
  const box = slides.parentElement;
  const pause = box.querySelector("[data-pause]");
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const go = (step) => {
    const count = slides.children.length;
    const at = Math.round(slides.scrollLeft / slides.clientWidth);
    slides.scrollTo({ left: ((at + step + count) % count) * slides.clientWidth, behavior: calm ? "auto" : "smooth" });
  };
  let paused = calm;
  pause.setAttribute("aria-pressed", paused);
  pause.addEventListener("click", () => {
    paused = !paused;
    pause.setAttribute("aria-pressed", paused);
  });
  box.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => go(Number(button.dataset.step))));
  setInterval(() => {
    if (!paused && !document.hidden && !box.matches(":hover, :focus-within")) go(1);
  }, 6000);
}
