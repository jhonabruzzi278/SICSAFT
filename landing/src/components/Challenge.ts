import { landingData } from "../data/landingData";

export function renderChallenge(): string {
  const { challenge } = landingData;

  const painsHtml = challenge.pains
    .map(
      (pain) => `
        <div class="flex items-center gap-3.5 p-4 sm:p-5 rounded-2xl bg-rose-500/5 border border-rose-500/15 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all duration-300">
          <div class="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0 text-rose-400">
            <i data-lucide="${pain.icon}" class="w-5 h-5"></i>
          </div>
          <span class="text-sm sm:text-base font-semibold text-slate-200">${pain.label}</span>
        </div>
      `
    )
    .join("\n");

  return `
    <section class="py-20 md:py-28 relative border-t border-slate-900/60" id="desafio">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center reveal">
          <!-- Copy -->
          <div class="lg:col-span-6 space-y-4">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold uppercase tracking-wider">
              ${challenge.eyebrow}
            </div>

            <p class="text-xl sm:text-2xl text-slate-300 font-normal leading-relaxed">
              Todas las organizaciones <strong class="text-white font-bold">poseen patrimonio</strong>.
            </p>
            <p class="text-xl sm:text-2xl text-slate-300 font-normal leading-relaxed">
              Pocas lo <strong class="text-sky-400 font-bold">conocen realmente</strong>.
            </p>
            <p class="text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
              Sin información confiable, es imposible <strong class="text-white font-semibold">decidir</strong> y
              <strong class="text-white font-semibold">gestionarlo estratégicamente</strong>.
            </p>
          </div>

          <!-- Pains Grid -->
          <div class="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
            ${painsHtml}
          </div>
        </div>
      </div>
    </section>
  `;
}
