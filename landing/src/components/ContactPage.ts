import { landingData } from "../data/landingData";
import { renderFooter } from "./Footer";

export function renderContactPage(): string {
  const { brand } = landingData;

  return `
    <div class="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] z-0" aria-hidden="true"></div>

    <!-- Dedicated Header -->
    <header class="fixed top-0 left-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/60" id="nav">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        <a class="flex flex-col group" href="/">
          <span class="font-display font-extrabold text-2xl tracking-wider text-white flex items-center gap-1">
            SICSAFT<span class="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 shadow-sm shadow-sky-400/50 group-hover:scale-125 transition-transform" aria-hidden="true"></span>
          </span>
          <span class="text-[10px] uppercase tracking-widest text-slate-400 font-medium font-mono">${brand.tagline}</span>
        </a>

        <a class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-750 transition-colors" href="/">
          <i data-lucide="arrow-left" class="w-4 h-4"></i>
          <span>Volver al inicio</span>
        </a>
      </div>
    </header>

    <main class="relative z-10 pt-32 pb-24 md:pt-40 md:pb-32">
      <!-- Glow ambient background -->
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-sky-500/10 blur-3xl pointer-events-none rounded-full" aria-hidden="true"></div>

      <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <!-- Page Header -->
        <div class="text-center max-w-3xl mx-auto mb-16 reveal">
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            Solicitud de Demostración
          </div>
          <h1 class="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight mb-4">
            Agende una demostración personalizada
          </h1>
          <p class="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Descubra en vivo cómo nuestro modelo inteligente transforma el control, la visibilidad y la trazabilidad del patrimonio en su organización.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start reveal">
          <!-- Left Column: Trust, Benefits & Direct channels -->
          <div class="lg:col-span-5 space-y-8">
            <div class="p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-xl">
              <h2 class="font-display font-bold text-xl text-white mb-4">¿Qué incluye la demo?</h2>
              <ul class="space-y-4 text-sm text-slate-300 mb-8">
                <li class="flex items-start gap-3">
                  <div class="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="check" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <strong class="block text-white font-medium">Recorrido por la plataforma</strong>
                    <span class="text-xs text-slate-400">Demostración en vivo de dashboards, escaneo QR/RFID y reportes.</span>
                  </div>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="check" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <strong class="block text-white font-medium">Propuesta a la medida</strong>
                    <span class="text-xs text-slate-400">Dimensionamiento según el tipo y volumen de activos de su entidad.</span>
                  </div>
                </li>
                <li class="flex items-start gap-3">
                  <div class="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="check" class="w-4 h-4"></i>
                  </div>
                  <div>
                    <strong class="block text-white font-medium">Asesoría técnica y normativa</strong>
                    <span class="text-xs text-slate-400">Respuestas directas sobre integración, seguridad y escalabilidad.</span>
                  </div>
                </li>
              </ul>

              <div class="pt-6 border-t border-slate-800/80 space-y-3.5">
                <div class="flex items-center gap-3 text-slate-300 text-sm">
                  <i data-lucide="mail" class="w-4 h-4 text-sky-400 shrink-0"></i>
                  <a href="mailto:${brand.email}" class="hover:text-sky-400 transition-colors">${brand.email}</a>
                </div>
                <div class="flex items-center gap-3 text-slate-400 text-xs">
                  <i data-lucide="clock" class="w-4 h-4 text-emerald-400 shrink-0"></i>
                  <span>Respuesta garantizada en menos de 24 horas hábiles.</span>
                </div>
                <div class="flex items-center gap-3 text-slate-400 text-xs">
                  <i data-lucide="shield-check" class="w-4 h-4 text-sky-400 shrink-0"></i>
                  <span>Privacidad garantizada bajo estricta confidencialidad.</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Interactive Contact Form -->
          <div class="lg:col-span-7">
            <div class="p-6 sm:p-10 rounded-3xl bg-slate-900/70 border border-slate-750 backdrop-blur-2xl shadow-2xl shadow-slate-950/60 relative">
              <form id="contact-form" class="space-y-5" onsubmit="event.preventDefault();">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <!-- Name -->
                  <div>
                    <label for="form-name" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Nombre completo *
                    </label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <i data-lucide="user" class="w-4 h-4"></i>
                      </div>
                      <input
                        type="text"
                        id="form-name"
                        name="name"
                        required
                        placeholder="Ej. Carlos Mendoza"
                        class="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  <!-- Email -->
                  <div>
                    <label for="form-email" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Correo corporativo *
                    </label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <i data-lucide="mail" class="w-4 h-4"></i>
                      </div>
                      <input
                        type="email"
                        id="form-email"
                        name="email"
                        required
                        placeholder="carlos@organizacion.com"
                        class="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <!-- Company / Organization -->
                  <div>
                    <label for="form-org" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Organización o Empresa *
                    </label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <i data-lucide="building-2" class="w-4 h-4"></i>
                      </div>
                      <input
                        type="text"
                        id="form-org"
                        name="organization"
                        required
                        placeholder="Nombre de su entidad"
                        class="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  <!-- Phone -->
                  <div>
                    <label for="form-phone" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Teléfono / WhatsApp *
                    </label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <i data-lucide="phone" class="w-4 h-4"></i>
                      </div>
                      <input
                        type="tel"
                        id="form-phone"
                        name="phone"
                        required
                        placeholder="+56 9 1234 5678"
                        class="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <!-- Sector -->
                  <div>
                    <label for="form-sector" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Sector / Tipo de Entidad
                    </label>
                    <select
                      id="form-sector"
                      name="sector"
                      class="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                    >
                      <option value="empresa" class="bg-slate-900">Empresa privada</option>
                      <option value="gobierno" class="bg-slate-900">Entidad pública / Gobierno</option>
                      <option value="educacion" class="bg-slate-900">Educación (Colegio / Universidad)</option>
                      <option value="salud" class="bg-slate-900">Salud (Hospital / Clínica)</option>
                      <option value="industria" class="bg-slate-900">Industria / Minería / Construcción</option>
                    </select>
                  </div>

                  <!-- Level / Interest -->
                  <div>
                    <label for="form-level" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                      Nivel de interés
                    </label>
                    <select
                      id="form-level"
                      name="level"
                      class="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                    >
                      <option value="nivel-2" class="bg-slate-900">Nivel 2: QR + Plataforma Web (Recomendado)</option>
                      <option value="nivel-1" class="bg-slate-900">Nivel 1: Identificación QR</option>
                      <option value="nivel-3" class="bg-slate-900">Nivel 3: QR + Web + RFID</option>
                      <option value="asesoria" class="bg-slate-900">Requiere asesoría / Evaluación previa</option>
                    </select>
                  </div>
                </div>

                <!-- Message -->
                <div>
                  <label for="form-msg" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                    Mensaje o requerimiento específico (opcional)
                  </label>
                  <textarea
                    id="form-msg"
                    name="message"
                    rows="3"
                    placeholder="Cuéntenos sobre el volumen de activos o requerimientos particulares..."
                    class="w-full px-4 py-3 bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none"
                  ></textarea>
                </div>

                <!-- Submit CTA -->
                <button
                  type="submit"
                  id="form-submit-btn"
                  class="w-full py-4 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-xl shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer text-base"
                >
                  <span>Solicitar demostración ahora</span>
                  <i data-lucide="send" class="w-4 h-4"></i>
                </button>

                <!-- Feedback notification -->
                <div id="form-feedback" class="hidden p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm text-center items-center justify-center gap-2">
                  <i data-lucide="check-circle" class="w-5 h-5 text-emerald-400 shrink-0"></i>
                  <span>¡Solicitud enviada con éxito! Un especialista de SICSAFT se comunicará con usted a la brevedad.</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>

    ${renderFooter()}
  `;
}
