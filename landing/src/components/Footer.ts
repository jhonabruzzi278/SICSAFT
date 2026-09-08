import { landingData } from "../data/landingData";

export function renderFooter(): string {
  return `
    <footer class="py-12 border-t border-slate-900 bg-slate-950 text-slate-400">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="font-display font-extrabold text-xl tracking-wider text-white flex items-center gap-1">
            SICSAFT<span class="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" aria-hidden="true"></span>
          </span>
          <span class="text-xs text-slate-400 font-mono">© ${new Date().getFullYear()}</span>
        </div>
        <p class="text-xs text-slate-400 font-medium">
          ${landingData.brand.tagline}
        </p>
      </div>
    </footer>
  `;
}
