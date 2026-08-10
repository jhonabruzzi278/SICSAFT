const nav = document.getElementById("nav");

const onScroll = (): void => {
  if (!nav) return;
  nav.classList.toggle("is-scrolled", window.scrollY > 8);
};
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

const revealTargets = document.querySelectorAll<HTMLElement>(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);
revealTargets.forEach((el) => observer.observe(el));
