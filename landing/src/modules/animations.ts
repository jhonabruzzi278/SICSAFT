/**
 * Animation and interaction module for SICSAFT landing page
 */

export function initNavScroll(navId = "nav"): void {
  const nav = document.getElementById(navId);
  if (!nav) return;

  const onScroll = (): void => {
    if (window.scrollY > 12) {
      nav.classList.add("bg-slate-950/85", "backdrop-blur-md", "border-b", "border-slate-800/80", "shadow-lg", "shadow-slate-950/50");
      nav.classList.remove("bg-transparent", "border-transparent");
    } else {
      nav.classList.remove("bg-slate-950/85", "backdrop-blur-md", "border-b", "border-slate-800/80", "shadow-lg", "shadow-slate-950/50");
      nav.classList.add("bg-transparent", "border-transparent");
    }
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

export function initScrollReveals(): void {
  const targets = document.querySelectorAll<HTMLElement>(".reveal, .stagger-children");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 }
  );

  targets.forEach((el) => observer.observe(el));
}

export function animateCounter(el: HTMLElement): void {
  const target = parseInt(el.dataset.target || "0", 10);
  const suffix = el.dataset.suffix || "";
  const prefix = el.dataset.prefix || "";
  const duration = 2000;
  const start = performance.now();

  function update(now: number): void {
    const progress = Math.min((now - start) / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);
    el.textContent = `${prefix}${current.toLocaleString("es-CL")}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

export function initCounters(): void {
  const counterTargets = document.querySelectorAll<HTMLElement>("[data-counter]");
  const counterObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          animateCounter(entry.target as HTMLElement);
          counterObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.3 }
  );

  counterTargets.forEach((el) => counterObserver.observe(el));
}

export function initHeroParallax(): void {
  const heroContent = document.querySelector<HTMLElement>(".hero-content-parallax");
  const heroImage = document.querySelector<HTMLElement>(".hero-image-parallax");

  if (heroContent && heroImage) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => {
            const scrollY = window.scrollY;
            if (scrollY < window.innerHeight) {
              heroContent.style.transform = `translateY(${scrollY * 0.06}px)`;
              heroImage.style.transform = `translateY(${scrollY * 0.03}px)`;
            }
            ticking = false;
          });
        }
      },
      { passive: true }
    );
  }
}

export function initSmoothScroll(): void {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}
