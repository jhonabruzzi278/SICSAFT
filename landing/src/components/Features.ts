import { landingData } from "../data/landingData";

export function renderFeatures(): string {
  const { features } = landingData;

  const cardsHtml = features.cards
    .map(
      (card) => `
        <article class="p-6 rounded-2xl bg-slate-900/40 border border-slate-800/70 hover:border-sky-500/40 hover:bg-slate-900/70 hover:-translate-y-1 transition-all duration-300 group">
          <div class="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-sky-500/20 transition-transform">
            <i data-lucide="${card.icon}" class="w-6 h-6"></i>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">${card.title}</h3>
          <p class="text-sm text-slate-400 leading-relaxed">${card.desc}</p>
        </article>
      `
    )
    .join("\n");

  const tagsHtml = features.tags
    .map(
      (t) => `
        <li class="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs sm:text-sm font-semibold text-slate-300">
          <i data-lucide="${t.icon}" class="w-4 h-4 text-sky-400"></i>
          <span>${t.label}</span>
        </li>
      `
    )
    .join("\n");

  return `
    <section class="py-20 md:py-28 relative bg-slate-900/20 border-t border-slate-800/60" id="funcionalidades">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 reveal">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4">
            ${features.eyebrow}
          </div>
          <h2 class="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight">
            ${features.title}
          </h2>
        </div>

        <!-- 3x3 Bento Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-14 reveal stagger-children">
          ${cardsHtml}
        </div>

        <!-- Tags row -->
        <ul class="flex flex-wrap items-center justify-center gap-3 reveal stagger-children">
          ${tagsHtml}
        </ul>
      </div>
    </section>
  `;
}
