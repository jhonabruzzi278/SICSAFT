import { landingData } from "../data/landingData";

export function renderLevels(): string {
  const { levels } = landingData;

  const levelsHtml = levels.items
    .map((lvl) => {
      const isHigh = !!lvl.highlight;
      const cardClass = isHigh
        ? "relative p-8 rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border-2 border-sky-500 shadow-xl shadow-sky-500/10 flex flex-col justify-between"
        : "relative p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 flex flex-col justify-between transition-colors";

      const badgeClass = isHigh
        ? "inline-block self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-500 text-slate-950 mb-4"
        : "inline-block self-start px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 mb-4";

      const featuresList = lvl.features
        .map(
          (f) => `
            <li class="flex items-start gap-3 text-sm text-slate-300">
              <i data-lucide="check-circle-2" class="w-4 h-4 text-sky-400 shrink-0 mt-0.5"></i>
              <span>${f}</span>
            </li>
          `
        )
        .join("\n");

      return `
        <article class="${cardClass}">
          <div>
            <span class="${badgeClass}">${lvl.badge}</span>
            <h3 class="font-display font-bold text-2xl text-white mb-1">${lvl.title}</h3>
            <p class="text-sm font-medium text-slate-400 mb-6">${lvl.subtitle}</p>
            <ul class="space-y-3 mb-8">
              ${featuresList}
            </ul>
          </div>
          <div class="pt-4 border-t border-slate-800/80 text-center">
            <span class="text-xs font-mono text-slate-400 uppercase tracking-wider">${lvl.tag}</span>
          </div>
        </article>
      `;
    })
    .join("\n");

  const sectorsHtml = levels.sectors
    .map(
      (sec) => `
        <li class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 text-slate-300 text-xs sm:text-sm font-medium hover:border-sky-500/40 transition-colors">
          <i data-lucide="${sec.icon}" class="w-4 h-4 text-sky-400 shrink-0"></i>
          <span>${sec.label}</span>
        </li>
      `
    )
    .join("\n");

  return `
    <section class="py-20 md:py-28 relative" id="niveles">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 reveal">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4">
            ${levels.eyebrow}
          </div>
          <h2 class="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
            ${levels.title}
          </h2>
        </div>

        <!-- Levels Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-14 reveal stagger-children">
          ${levelsHtml}
        </div>

        <!-- Closing text -->
        <p class="text-center text-slate-300 text-sm sm:text-base max-w-2xl mx-auto mb-10 reveal">
          ${levels.closing.text}<strong class="text-sky-400 font-semibold">${levels.closing.accent}</strong>
        </p>

        <!-- Sectors row -->
        <ul class="flex flex-wrap items-center justify-center gap-3 reveal stagger-children">
          ${sectorsHtml}
        </ul>
      </div>
    </section>
  `;
}
