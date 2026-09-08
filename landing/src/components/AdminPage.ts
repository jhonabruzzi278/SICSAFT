import { getLeads, getWebhookUrl } from "../modules/leadStore";

export function renderAdminLogin(): string {
  return `
    <div class="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] z-0" aria-hidden="true"></div>

    <div class="min-h-screen flex items-center justify-center p-4 relative z-10">
      <div class="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-750 backdrop-blur-2xl shadow-2xl shadow-slate-950/80">
        <div class="text-center mb-8">
          <span class="font-display font-extrabold text-3xl tracking-wider text-white flex items-center justify-center gap-1 mb-2">
            SICSAFT<span class="inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 shadow-sm shadow-sky-400/50" aria-hidden="true"></span>
          </span>
          <p class="text-xs uppercase tracking-widest text-slate-400 font-mono">Panel de Administración de Leads</p>
        </div>

        <form id="admin-login-form" class="space-y-5" onsubmit="event.preventDefault();">
          <div>
            <label for="admin-pin" class="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Contraseña de Acceso
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <i data-lucide="key-round" class="w-4 h-4"></i>
              </div>
              <input
                type="password"
                id="admin-pin"
                required
                placeholder="Ingrese contraseña de administrador"
                class="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            id="admin-login-btn"
            class="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-xl shadow-sky-500/20 hover:shadow-sky-500/35 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Ingresar al Panel</span>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>

          <div id="login-error" class="hidden p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center">
            Contraseña incorrecta. Intente nuevamente.
          </div>

          <div class="pt-4 border-t border-slate-800 text-center">
            <a href="/" class="text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              <span>Volver a la landing</span>
            </a>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function renderAdminDashboard(): string {
  const leads = getLeads();
  const webhookUrl = getWebhookUrl();

  const total = leads.length;
  const pendientes = leads.filter((l) => l.status === "Pendiente").length;
  const agendadas = leads.filter((l) => l.status === "Demo Agendada").length;
  const contactados = leads.filter((l) => l.status === "Contactado" || l.status === "Cerrado").length;

  return `
    <div class="min-h-screen bg-slate-950 text-slate-100 pb-16">
      <!-- Top Navigation -->
      <header class="bg-slate-900/80 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <a class="flex flex-col group" href="/admin">
              <span class="font-display font-extrabold text-xl sm:text-2xl tracking-wider text-white flex items-center gap-1">
                SICSAFT<span class="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 shadow-sm shadow-sky-400/50" aria-hidden="true"></span>
              </span>
              <span class="text-[9px] sm:text-[10px] uppercase tracking-widest text-sky-400 font-medium font-mono">Panel de Control de Leads</span>
            </a>
          </div>

          <div class="flex items-center gap-2 sm:gap-3">
            <a href="/" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 transition-colors">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              <span class="hidden md:inline">Ver Sitio Web</span>
            </a>
            <button id="admin-logout-btn" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer">
              <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <!-- Stats summary cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Total Solicitudes</span>
              <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                <i data-lucide="users" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
              </div>
            </div>
            <div class="text-2xl sm:text-3xl font-display font-extrabold text-white">${total}</div>
          </div>

          <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-amber-500/20">
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400">Pendientes</span>
              <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <i data-lucide="clock" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
              </div>
            </div>
            <div class="text-2xl sm:text-3xl font-display font-extrabold text-amber-400">${pendientes}</div>
          </div>

          <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-purple-500/20">
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-purple-400">Demos Agendadas</span>
              <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <i data-lucide="calendar" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
              </div>
            </div>
            <div class="text-2xl sm:text-3xl font-display font-extrabold text-purple-400">${agendadas}</div>
          </div>

          <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/20">
            <div class="flex items-center justify-between mb-1 sm:mb-2">
              <span class="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-400">Contactados</span>
              <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
              </div>
            </div>
            <div class="text-2xl sm:text-3xl font-display font-extrabold text-emerald-400">${contactados}</div>
          </div>
        </div>

        <!-- Google Sheets Integration Banner -->
        <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 to-sky-950/30 border border-slate-800 mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-start sm:items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
              <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white flex items-center gap-2">
                Sincronización con Google Sheets / CRM
                ${webhookUrl ? `<span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-normal">Activo</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-normal">No configurado</span>`}
              </h3>
              <p class="text-xs text-slate-400">Cada nueva solicitud se inserta automáticamente en tiempo real en tu planilla.</p>
            </div>
          </div>

          <button id="toggle-webhook-modal-btn" class="px-4 py-2 rounded-xl text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer">
            <i data-lucide="settings" class="w-3.5 h-3.5"></i>
            <span>${webhookUrl ? "Editar Webhook" : "Configurar Webhook"}</span>
          </button>
        </div>

        <!-- Webhook Configuration Modal/Drawer -->
        <div id="webhook-modal" class="hidden p-5 sm:p-6 rounded-2xl bg-slate-900 border border-sky-500/30 mb-6 sm:mb-8 space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <i data-lucide="database" class="w-4 h-4 text-sky-400"></i>
              Configurar URL de Webhook de Google Sheets
            </h4>
            <button id="close-webhook-modal-btn" class="text-slate-400 hover:text-white text-xs cursor-pointer">Cerrar</button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            Pega aquí la URL de tu Webhook (por ejemplo de un Google Apps Script desplegado como Web App, Make o Zapier).
          </p>
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              id="webhook-url-input"
              value="${webhookUrl}"
              placeholder="https://script.google.com/macros/s/.../exec"
              class="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
            <button id="save-webhook-btn" class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 transition-colors cursor-pointer">
              Guardar Webhook
            </button>
          </div>
        </div>

        <!-- Filter & Search toolbar -->
        <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 mb-6">
          <div class="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 flex-1">
            <!-- Search -->
            <div class="relative flex-1 min-w-[200px]">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <i data-lucide="search" class="w-3.5 h-3.5"></i>
              </div>
              <input
                type="text"
                id="lead-search-input"
                placeholder="Buscar por nombre, entidad, correo..."
                class="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <!-- Status filter -->
            <select id="filter-status" class="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500">
              <option value="all">Todos los estados</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Contactado">Contactado</option>
              <option value="Demo Agendada">Demo Agendada</option>
              <option value="Cerrado">Cerrado</option>
            </select>

            <!-- Sector filter -->
            <select id="filter-sector" class="px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500">
              <option value="all">Todos los sectores</option>
              <option value="salud">Salud</option>
              <option value="gobierno">Entidades públicas / Gobierno</option>
              <option value="empresa">Empresas privadas</option>
              <option value="educacion">Educación</option>
              <option value="industria">Industria</option>
            </select>
          </div>

          <!-- Export Action -->
          <div class="flex items-center justify-end">
            <button id="export-csv-btn" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Exportar CSV / Excel</span>
            </button>
          </div>
        </div>

        <!-- Responsive Leads Container -->
        <!-- 1. Desktop & Tablet Table (Hidden on small mobile screens) -->
        <div class="hidden md:block rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-xl">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-slate-300" id="leads-table">
              <thead class="bg-slate-950/70 uppercase tracking-wider text-[10px] text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th class="px-4 lg:px-5 py-3.5 whitespace-nowrap">Fecha</th>
                  <th class="px-4 lg:px-5 py-3.5 min-w-[200px]">Solicitante</th>
                  <th class="px-4 lg:px-5 py-3.5 min-w-[170px]">Organización & Sector</th>
                  <th class="px-4 lg:px-5 py-3.5 whitespace-nowrap">Interés</th>
                  <th class="px-4 lg:px-5 py-3.5 min-w-[200px]">Mensaje / Detalle</th>
                  <th class="px-4 lg:px-5 py-3.5 whitespace-nowrap">Estado</th>
                  <th class="px-4 lg:px-5 py-3.5 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/60" id="leads-tbody">
                <!-- Populated via admin.ts -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Mobile Cards Grid (Shown only on small screens < 768px) -->
        <div class="block md:hidden space-y-3" id="leads-mobile-container">
          <!-- Populated via admin.ts -->
        </div>

        <div id="leads-empty" class="hidden py-12 text-center text-slate-500 text-xs bg-slate-900/30 rounded-2xl border border-slate-850">
          No se encontraron solicitudes con los filtros aplicados.
        </div>
      </main>
    </div>
  `;
}
