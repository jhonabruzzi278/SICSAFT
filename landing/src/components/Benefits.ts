import { landingData } from "../data/landingData";

export function renderBenefits(): string {
  const { benefits } = landingData;

  const itemsHtml = benefits.items
    .map(
      (b) => `
        <div class="flex items-start gap-4 p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-sky-500/40 hover:bg-slate-850/80 transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <i data-lucide="${b.icon}" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-white mb-1">${b.title}</h3>
            <p class="text-sm text-slate-400 leading-relaxed">${b.desc}</p>
          </div>
        </div>
      `
    )
    .join("\n");

  return `
    <section class="py-20 md:py-28 relative bg-slate-900/40 border-y border-slate-800/60" id="beneficios">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 reveal">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4">
            ${benefits.eyebrow}
          </div>
          <h2 class="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
            ${benefits.title}
          </h2>
        </div>

        <!-- Orbit Container -->
        <div class="relative max-w-5xl mx-auto mb-14 reveal">
          <!-- Center Banner -->
          <div class="text-center py-6 px-8 rounded-3xl bg-gradient-to-r from-sky-900/40 via-indigo-900/40 to-sky-900/40 border border-sky-500/30 max-w-md mx-auto mb-10 shadow-lg shadow-sky-950/50">
            <span class="block text-xs uppercase tracking-widest text-sky-300 font-mono mb-1">${benefits.center.sub}</span>
            <strong class="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight">${benefits.center.main}</strong>
          </div>

          <!-- 6 Benefits Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            ${itemsHtml}
          </div>
        </div>

        <!-- Closing text -->
        <p class="text-center text-slate-300 text-sm sm:text-base max-w-2xl mx-auto reveal">
          ${benefits.closing.text}<strong class="text-sky-400 font-semibold">${benefits.closing.accent}</strong>
        </p>
      </div>
    </section>
  `;
}
