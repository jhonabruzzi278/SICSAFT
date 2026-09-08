import { landingData } from "../data/landingData";

export function renderPlatform(): string {
  const { platform } = landingData;

  const sectorsHtml = platform.sectors
    .map(
      (sec) => `
        <li class="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-slate-700 transition-colors">
          <div class="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="${sec.icon}" class="w-4 h-4"></i>
          </div>
          <div>
            <strong class="block text-sm font-bold text-white mb-0.5">${sec.title}</strong>
            <span class="text-xs text-slate-400 leading-relaxed">${sec.desc}</span>
          </div>
        </li>
      `
    )
    .join("\n");

  const channelsHtml = platform.channels
    .map(
      (ch) => `
        <li class="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/60 hover:border-slate-700 transition-colors">
          <div class="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
            <i data-lucide="${ch.icon}" class="w-4 h-4"></i>
          </div>
          <div>
            <strong class="block text-sm font-bold text-white mb-0.5">${ch.title}</strong>
            <span class="text-xs text-slate-400 leading-relaxed">${ch.desc}</span>
          </div>
        </li>
      `
    )
    .join("\n");

  const tagsHtml = platform.tags
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
    <section class="py-20 md:py-28 relative" id="plataforma">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 reveal">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4">
            ${platform.eyebrow}
          </div>
          <h2 class="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight mb-4">
            ${platform.title}
          </h2>
          <p class="text-base sm:text-lg text-slate-300 leading-relaxed">
            ${platform.lead}
          </p>
        </div>

        <!-- 3 Columns Platform Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center mb-14 reveal">
          <!-- Left Column: Sectors -->
          <div class="lg:col-span-4 space-y-4">
            <h3 class="text-base font-bold text-white uppercase tracking-wider text-center lg:text-left mb-4">
              ${platform.sectorsColTitle}
            </h3>
            <ul class="space-y-3">
              ${sectorsHtml}
            </ul>
          </div>

          <!-- Center Column: Image -->
          <div class="lg:col-span-4 rounded-2xl overflow-hidden p-2 bg-gradient-to-b from-slate-700/30 to-slate-900/40 border border-slate-700/50 backdrop-blur-xl shadow-xl shadow-sky-950/30">
            <div class="relative rounded-xl overflow-hidden bg-slate-950">
              <img
                src="/img/platform-dashboard.jpg"
                alt="Dashboard de tracking de activos SICSAFT mostrando inventario en vivo, categorías de activos, distribución y ubicaciones en tiempo real"
                class="w-full h-auto object-cover rounded-xl"
                width="900"
                height="600"
                loading="lazy"
              />
            </div>
          </div>

          <!-- Right Column: Channels -->
          <div class="lg:col-span-4 space-y-4">
            <h3 class="text-base font-bold text-white uppercase tracking-wider text-center lg:text-left mb-4">
              ${platform.channelsColTitle}
            </h3>
            <ul class="space-y-3">
              ${channelsHtml}
            </ul>
          </div>
        </div>

        <!-- Tags row -->
        <ul class="flex flex-wrap items-center justify-center gap-3 reveal stagger-children">
          ${tagsHtml}
        </ul>
      </div>
    </section>
  `;
}
