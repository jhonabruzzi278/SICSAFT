import { renderApp } from "../components/App";
import { renderContactPage } from "../components/ContactPage";
import { initLucideIcons } from "./icons";
import {
  initNavScroll,
  initScrollReveals,
  initCounters,
  initHeroParallax,
  initSmoothScroll,
} from "./animations";
import { initContactForm } from "./form";
import { initAdmin } from "./admin";

export function getRoute(): "home" | "contact" | "admin" {
  const path = window.location.pathname.toLowerCase().replace(/\/$/, "");
  const hash = window.location.hash.toLowerCase();

  if (path === "/admin" || hash === "#/admin" || hash === "#admin") {
    return "admin";
  }

  if (
    path === "/contacto" ||
    path === "/demo" ||
    hash === "#/contacto" ||
    hash === "#/demo"
  ) {
    return "contact";
  }

  return "home";
}

export function navigateTo(url: string): void {
  window.history.pushState({}, "", url);
  renderCurrentRoute();
}

export function renderCurrentRoute(): void {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  const route = getRoute();

  if (route === "admin") {
    initAdmin();
    window.scrollTo({ top: 0, behavior: "instant" });
  } else if (route === "contact") {
    appContainer.innerHTML = renderContactPage();
    window.scrollTo({ top: 0, behavior: "instant" });
    initLucideIcons();
    initContactForm();
    initScrollReveals();
  } else {
    appContainer.innerHTML = renderApp();
    initLucideIcons();
    initNavScroll("nav");
    initScrollReveals();
    initCounters();
    initHeroParallax();
    initSmoothScroll();
    initContactForm();
  }

  // Intercept all internal links for instant SPA navigation
  document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("//") || link.target === "_blank") return;
      e.preventDefault();
      navigateTo(href);
    });
  });
}

export function initRouter(): void {
  window.addEventListener("popstate", () => {
    renderCurrentRoute();
  });

  renderCurrentRoute();
}
