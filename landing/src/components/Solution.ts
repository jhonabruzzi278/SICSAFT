import { landingData } from "../data/landingData";

export function renderSolution(): string {
  const { solution } = landingData;

  const featuresHtml = solution.features
    .map(
      (feat) => `
        <div class="flex items-start gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-sky-500/40 hover:bg-slate-850/80 transition-all duration-300">
          <div class="w-11 h-11 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <i data-lucide="${feat.icon}" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-white mb-1">${feat.title}</h3>
            <p class="text-sm text-slate-400 leading-relaxed">${feat.desc}</p>
          </div>
        </div>
      `
    )
    .join("\n");

  const statsHtml = solution.stats
    .map(
      (stat) => `
        <div class="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center hover:border-slate-700 transition-colors">
          <span class="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight mb-2" data-counter data-target="${stat.target}" data-prefix="${stat.prefix || ""}" data-suffix="${stat.suffix || ""}">0</span>
          <span class="text-xs sm:text-sm font-medium text-slate-400">${stat.label}</span>
        </div>
      `
    )
    .join("\n");

  return `
    <section class="py-20 md:py-28 relative bg-slate-900/30 border-y border-slate-800/60" id="solucion">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 reveal">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4">
            ${solution.eyebrow}
          </div>
          <h2 class="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight mb-4">
            ${solution.title}<br />
            <span class="bg-gradient-to-r from-sky-400 to-indigo-300 bg-clip-text text-transparent">${solution.accentTitle}</span>
          </h2>
          <p class="text-base sm:text-lg text-slate-300 leading-relaxed">
            ${solution.lead}
          </p>
        </div>

        <!-- Devices Showcase Image -->
        <div class="w-full max-w-5xl mx-auto rounded-2xl overflow-hidden p-2 sm:p-3 bg-gradient-to-b from-slate-700/30 to-slate-900/40 border border-slate-700/40 backdrop-blur-xl shadow-2xl shadow-sky-950/30 reveal mb-14">
          <div class="relative rounded-xl overflow-hidden bg-slate-950">
            <img
              src="/img/solution-devices.jpg"
              alt="Laptop, tablet y smartphone mostrando la plataforma SICSAFT con dashboards de analítica, tracking de activos y escaneo QR"
              class="w-full h-auto object-cover rounded-xl"
              width="1400"
              height="788"
              loading="lazy"
            />
          </div>
        </div>

        <!-- Feature Pills Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16 reveal stagger-children">
          ${featuresHtml}
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12 reveal stagger-children">
          ${statsHtml}
        </div>

        <!-- Closing callout -->
        <p class="text-center text-slate-300 text-sm sm:text-base max-w-2xl mx-auto reveal">
          ${solution.closing.text}<strong class="text-white font-semibold">${solution.closing.bold}</strong>${solution.closing.middle}<strong class="text-sky-400 font-semibold">${solution.closing.accent}</strong>
        </p>
      </div>
    </section>
  `;
}
