import { landingData } from "../data/landingData";

export function renderContact(): string {
  const { contact } = landingData;

  return `
    <section class="py-24 md:py-32 relative bg-gradient-to-b from-slate-900/60 to-slate-950 border-t border-slate-800/80 overflow-hidden" id="contacto">
      <!-- Glow effect -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-sky-500/10 blur-3xl pointer-events-none rounded-full" aria-hidden="true"></div>

      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center reveal">
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-6">
          ${contact.eyebrow}
        </div>

        <h2 class="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight leading-tight mb-6">
          ${contact.title}
        </h2>

        <p class="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">
          ${contact.lead}
        </p>

        <a class="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-2xl shadow-sky-500/30 hover:shadow-sky-500/50 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-base sm:text-lg cursor-pointer" href="/contacto">
          <span>Solicitar una demo</span>
          <i data-lucide="arrow-right" class="w-5 h-5"></i>
        </a>
      </div>
    </section>
  `;
}
