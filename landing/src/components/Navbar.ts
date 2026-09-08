import { landingData } from "../data/landingData";

export function renderNavbar(): string {
  const { navLinks } = landingData;

  const linksHtml = navLinks
    .map(
      (link) =>
        `<a href="${link.href}" class="text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200 py-1 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-sky-400 after:transition-all after:duration-300 hover:after:w-full">${link.label}</a>`
    )
    .join("\n");

  return `
    <header class="fixed top-0 left-0 w-full z-50 transition-all duration-300 bg-slate-950/60 backdrop-blur-md border-b border-slate-800/50" id="nav">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <a class="flex flex-col group" href="#top">
          <span class="font-display font-extrabold text-2xl tracking-wider text-white flex items-center gap-1">
            SICSAFT<span class="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 shadow-sm shadow-sky-400/50 group-hover:scale-125 transition-transform" aria-hidden="true"></span>
          </span>
          <span class="text-[10px] uppercase tracking-widest text-slate-400 font-medium font-mono">${landingData.brand.tagline}</span>
        </a>

        <nav class="hidden md:flex items-center gap-8" aria-label="Navegación principal">
          ${linksHtml}
        </nav>

        <a class="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer" href="/contacto">
          Solicitar demo
        </a>
      </div>
    </header>
  `;
}
