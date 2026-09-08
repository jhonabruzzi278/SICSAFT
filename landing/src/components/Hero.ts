import { landingData } from "../data/landingData";

export function renderHero(): string {
  const { pillars } = landingData;

  const pillarsHtml = pillars
    .map(
      (p) => `
        <li class="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm text-slate-300 hover:text-white hover:border-sky-500/50 hover:bg-slate-850/80 transition-all duration-300 shadow-sm">
          <i data-lucide="${p.icon}" class="w-4 h-4 text-sky-400 shrink-0"></i>
          <span class="text-xs sm:text-sm font-medium">${p.label}</span>
        </li>
      `
    )
    .join("\n");

  return `
    <section class="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      <!-- Subtle top gradient glow -->
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[350px] bg-gradient-to-tr from-sky-500/15 via-indigo-600/10 to-transparent blur-3xl pointer-events-none rounded-full" aria-hidden="true"></div>

      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
        <!-- Text content -->
        <div class="hero-content-parallax max-w-3xl flex flex-col items-center reveal">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            Modelo Inteligente de Gestión Patrimonial
          </div>

          <h1 class="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.15] mb-6">
            ¿Su organización conoce realmente<br class="hidden sm:inline" />
            el estado de <span class="bg-gradient-to-r from-sky-400 via-indigo-300 to-sky-200 bg-clip-text text-transparent">todo su patrimonio</span>?
          </h1>

          <p class="text-base sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed mb-8">
            Cada activo representa una inversión. Gestionarlo inteligentemente representa una
            <strong class="text-white font-semibold">ventaja estratégica</strong>.
          </p>

          <div class="flex flex-wrap items-center justify-center gap-4 mb-14">
            <a class="px-7 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-xl shadow-sky-500/20 hover:shadow-sky-500/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm sm:text-base flex items-center gap-2 cursor-pointer" href="/contacto">
              <span>Solicitar una demo</span>
              <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </a>
            <a class="px-7 py-3.5 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-750 hover:border-slate-600 backdrop-blur-sm transition-all duration-200 text-sm sm:text-base" href="#solucion">
              Conocer la plataforma
            </a>
          </div>
        </div>

        <!-- Hero image -->
        <div class="hero-image-parallax w-full max-w-5xl rounded-2xl overflow-hidden p-2 sm:p-3 bg-gradient-to-b from-slate-700/40 via-slate-800/20 to-slate-900/40 border border-slate-700/50 backdrop-blur-xl shadow-2xl shadow-sky-950/40 reveal mb-12">
          <div class="relative rounded-xl overflow-hidden bg-slate-950">
            <img
              src="/img/hero-dashboard.jpg"
              alt="Dashboard de gestión patrimonial SICSAFT mostrando gráficos de inventario, mapa de activos y escaneo QR"
              class="w-full h-auto object-cover rounded-xl transition-transform duration-700 hover:scale-[1.01]"
              width="1400"
              height="788"
              loading="eager"
              fetchpriority="high"
            />
          </div>
        </div>

        <!-- Pillars list -->
        <ul class="flex flex-wrap items-center justify-center gap-3 sm:gap-4 reveal stagger-children">
          ${pillarsHtml}
        </ul>
      </div>
    </section>
  `;
}
