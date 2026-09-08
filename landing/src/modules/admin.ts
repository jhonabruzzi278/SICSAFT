import {
  getLeads,
  updateLeadStatus,
  deleteLead,
  exportLeadsToCSV,
  setWebhookUrl,
  DemoLead,
} from "./leadStore";
import { renderAdminLogin, renderAdminDashboard } from "../components/AdminPage";
import { initLucideIcons } from "./icons";

const AUTH_KEY = "sicsaft_admin_authenticated";
const ADMIN_PASSWORD = "jon207";

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === "true";
}

export function initAdmin(): void {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  if (!isAdminAuthenticated()) {
    appContainer.innerHTML = renderAdminLogin();
    initLucideIcons();
    setupLoginForm();
  } else {
    appContainer.innerHTML = renderAdminDashboard();
    initLucideIcons();
    setupDashboard();
  }
}

function setupLoginForm(): void {
  const form = document.getElementById("admin-login-form") as HTMLFormElement | null;
  const pinInput = document.getElementById("admin-pin") as HTMLInputElement | null;
  const errorMsg = document.getElementById("login-error");

  if (!form || !pinInput) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (pinInput.value.trim() === ADMIN_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      initAdmin();
    } else {
      if (errorMsg) errorMsg.classList.remove("hidden");
      pinInput.value = "";
      pinInput.focus();
    }
  });
}

function setupDashboard(): void {
  const searchInput = document.getElementById("lead-search-input") as HTMLInputElement | null;
  const statusFilter = document.getElementById("filter-status") as HTMLSelectElement | null;
  const sectorFilter = document.getElementById("filter-sector") as HTMLSelectElement | null;
  const exportBtn = document.getElementById("export-csv-btn");
  const logoutBtn = document.getElementById("admin-logout-btn");
  const toggleWebhookBtn = document.getElementById("toggle-webhook-modal-btn");
  const closeWebhookBtn = document.getElementById("close-webhook-modal-btn");
  const saveWebhookBtn = document.getElementById("save-webhook-btn");
  const webhookInput = document.getElementById("webhook-url-input") as HTMLInputElement | null;
  const webhookModal = document.getElementById("webhook-modal");

  // Initial render of table and mobile cards
  renderLeadsViews();

  // Filters and search listeners
  searchInput?.addEventListener("input", renderLeadsViews);
  statusFilter?.addEventListener("change", renderLeadsViews);
  sectorFilter?.addEventListener("change", renderLeadsViews);

  // CSV Export
  exportBtn?.addEventListener("click", () => {
    exportLeadsToCSV();
  });

  // Logout
  logoutBtn?.addEventListener("click", () => {
    sessionStorage.removeItem(AUTH_KEY);
    initAdmin();
  });

  // Webhook Drawer Toggle
  toggleWebhookBtn?.addEventListener("click", () => {
    webhookModal?.classList.toggle("hidden");
  });

  closeWebhookBtn?.addEventListener("click", () => {
    webhookModal?.classList.add("hidden");
  });

  saveWebhookBtn?.addEventListener("click", () => {
    if (webhookInput) {
      setWebhookUrl(webhookInput.value);
      alert("URL de Webhook guardada exitosamente. Las próximas solicitudes se enviarán a Google Sheets.");
      webhookModal?.classList.add("hidden");
      initAdmin();
    }
  });
}

function renderLeadsViews(): void {
  const tbody = document.getElementById("leads-tbody");
  const mobileContainer = document.getElementById("leads-mobile-container");
  const emptyMsg = document.getElementById("leads-empty");
  const searchInput = document.getElementById("lead-search-input") as HTMLInputElement | null;
  const statusFilter = document.getElementById("filter-status") as HTMLSelectElement | null;
  const sectorFilter = document.getElementById("filter-sector") as HTMLSelectElement | null;

  const query = (searchInput?.value || "").toLowerCase().trim();
  const status = statusFilter?.value || "all";
  const sector = sectorFilter?.value || "all";

  let leads = getLeads();

  // Apply filters
  leads = leads.filter((lead) => {
    const matchesSearch =
      !query ||
      lead.name.toLowerCase().includes(query) ||
      lead.email.toLowerCase().includes(query) ||
      lead.organization.toLowerCase().includes(query) ||
      lead.phone.toLowerCase().includes(query);

    const matchesStatus = status === "all" || lead.status === status;
    const matchesSector = sector === "all" || lead.sector === sector;

    return matchesSearch && matchesStatus && matchesSector;
  });

  if (leads.length === 0) {
    if (tbody) tbody.innerHTML = "";
    if (mobileContainer) mobileContainer.innerHTML = "";
    emptyMsg?.classList.remove("hidden");
    return;
  }

  emptyMsg?.classList.add("hidden");

  const getStatusClass = (st: string) => {
    switch (st) {
      case "Pendiente":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "Contactado":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "Demo Agendada":
        return "bg-purple-500/15 text-purple-300 border-purple-500/30";
      case "Cerrado":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  // 1. Render Desktop / Tablet Table Rows
  if (tbody) {
    tbody.innerHTML = leads
      .map((l) => {
        const cleanPhone = l.phone.replace(/[^0-9]/g, "");
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;
        const dateObj = new Date(l.createdAt);
        const dayStr = dateObj.toLocaleDateString("es-CL", {
          month: "short",
          day: "numeric",
        });
        const timeStr = dateObj.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return `
          <tr class="hover:bg-slate-850/50 transition-colors">
            <!-- Date -->
            <td class="px-4 lg:px-5 py-3.5 whitespace-nowrap font-mono">
              <div class="text-[10px] text-slate-300 font-medium">${dayStr}</div>
              <div class="text-[9px] text-slate-500">${timeStr}</div>
            </td>

            <!-- Contact info -->
            <td class="px-4 lg:px-5 py-4">
              <div class="font-bold text-white text-sm mb-1">${l.name}</div>
              <div class="flex flex-wrap items-center gap-2 text-slate-400 text-xs">
                <a href="mailto:${l.email}" class="hover:text-sky-400 flex items-center gap-1">
                  <i data-lucide="mail" class="w-3.5 h-3.5 text-sky-400 shrink-0"></i>
                  <span>${l.email}</span>
                </a>
                ${
                  waLink
                    ? `<a href="${waLink}" target="_blank" class="hover:text-emerald-400 flex items-center gap-1 text-emerald-400 font-medium">
                        <i data-lucide="phone" class="w-3.5 h-3.5 shrink-0"></i>
                        <span>${l.phone}</span>
                      </a>`
                    : `<span class="flex items-center gap-1"><i data-lucide="phone" class="w-3.5 h-3.5 shrink-0"></i>${l.phone}</span>`
                }
              </div>
            </td>

            <!-- Organization & Sector -->
            <td class="px-4 lg:px-5 py-4">
              <div class="font-semibold text-slate-200">${l.organization}</div>
              <span class="inline-block px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-400 mt-1">
                ${l.sector}
              </span>
            </td>

            <!-- Level -->
            <td class="px-4 lg:px-5 py-4 whitespace-nowrap">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-500/10 border border-sky-500/20 text-sky-300">
                ${l.level}
              </span>
            </td>

            <!-- Message -->
            <td class="px-4 lg:px-5 py-4 max-w-xs">
              <p class="text-slate-300 text-xs line-clamp-2" title="${l.message || "Sin mensaje"}">
                ${l.message || '<span class="text-slate-500 italic">Sin comentarios</span>'}
              </p>
            </td>

            <!-- Status Selector -->
            <td class="px-4 lg:px-5 py-4 whitespace-nowrap">
              <select
                data-lead-id="${l.id}"
                class="status-select px-2.5 py-1.5 rounded-lg text-xs font-semibold border focus:outline-none cursor-pointer transition-colors ${getStatusClass(l.status)}"
              >
                <option value="Pendiente" ${l.status === "Pendiente" ? "selected" : ""} class="bg-slate-900 text-amber-400">Pendiente</option>
                <option value="Contactado" ${l.status === "Contactado" ? "selected" : ""} class="bg-slate-900 text-sky-400">Contactado</option>
                <option value="Demo Agendada" ${l.status === "Demo Agendada" ? "selected" : ""} class="bg-slate-900 text-purple-400">Demo Agendada</option>
                <option value="Cerrado" ${l.status === "Cerrado" ? "selected" : ""} class="bg-slate-900 text-emerald-400">Cerrado</option>
              </select>
            </td>

            <!-- Actions -->
            <td class="px-4 lg:px-5 py-4 text-right whitespace-nowrap">
              <button
                data-delete-id="${l.id}"
                class="delete-btn p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Eliminar solicitud"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("\n");
  }

  // 2. Render Mobile Cards View
  if (mobileContainer) {
    mobileContainer.innerHTML = leads
      .map((l) => {
        const cleanPhone = l.phone.replace(/[^0-9]/g, "");
        const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;
        const dateObj = new Date(l.createdAt);
        const dayStr = dateObj.toLocaleDateString("es-CL", {
          month: "short",
          day: "numeric",
        });
        const timeStr = dateObj.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return `
          <div class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-lg">
            <!-- Header: Date and Status selector -->
            <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
              <div class="flex items-center gap-1.5 text-slate-400 font-mono text-[10px]">
                <i data-lucide="clock" class="w-3 h-3 text-slate-500"></i>
                <span>${dayStr} · <span class="text-slate-500">${timeStr}</span></span>
              </div>
              <select
                data-lead-id="${l.id}"
                class="status-select px-2.5 py-1 rounded-lg text-xs font-semibold border focus:outline-none cursor-pointer transition-colors ${getStatusClass(l.status)}"
              >
                <option value="Pendiente" ${l.status === "Pendiente" ? "selected" : ""} class="bg-slate-900 text-amber-400">Pendiente</option>
                <option value="Contactado" ${l.status === "Contactado" ? "selected" : ""} class="bg-slate-900 text-sky-400">Contactado</option>
                <option value="Demo Agendada" ${l.status === "Demo Agendada" ? "selected" : ""} class="bg-slate-900 text-purple-400">Demo Agendada</option>
                <option value="Cerrado" ${l.status === "Cerrado" ? "selected" : ""} class="bg-slate-900 text-emerald-400">Cerrado</option>
              </select>
            </div>

            <!-- Client & Org details -->
            <div>
              <div class="font-bold text-white text-base leading-snug">${l.name}</div>
              <div class="text-xs text-slate-300 font-medium">${l.organization}</div>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 text-slate-400">
                  ${l.sector}
                </span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 border border-sky-500/20 text-sky-300">
                  ${l.level}
                </span>
              </div>
            </div>

            <!-- Client Message -->
            ${
              l.message
                ? `<div class="p-2.5 rounded-xl bg-slate-950/60 border border-slate-850 text-xs text-slate-300 leading-relaxed">
                    <span class="text-slate-500 text-[10px] uppercase font-mono block mb-0.5">Mensaje:</span>
                    ${l.message}
                   </div>`
                : ""
            }

            <!-- Quick Action Buttons: WhatsApp & Email & Delete -->
            <div class="flex items-center gap-2 pt-2">
              ${
                waLink
                  ? `<a href="${waLink}" target="_blank" class="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
                      <i data-lucide="phone" class="w-3.5 h-3.5"></i>
                      <span>WhatsApp</span>
                    </a>`
                  : ""
              }
              <a href="mailto:${l.email}" class="flex-1 py-2 px-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
                <i data-lucide="mail" class="w-3.5 h-3.5"></i>
                <span>Email</span>
              </a>
              <button
                data-delete-id="${l.id}"
                class="delete-btn p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors cursor-pointer"
                title="Eliminar solicitud"
              >
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join("\n");
  }

  initLucideIcons();

  // Attach status change events to all selects (both desktop and mobile)
  document.querySelectorAll<HTMLSelectElement>(".status-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      const leadId = target.dataset.leadId;
      if (leadId) {
        updateLeadStatus(leadId, target.value as DemoLead["status"]);
        renderLeadsViews();
      }
    });
  });

  // Attach delete events to all delete buttons
  document.querySelectorAll<HTMLButtonElement>(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = (e.currentTarget as HTMLElement).closest("[data-delete-id]") as HTMLElement;
      const leadId = target?.dataset.deleteId;
      if (leadId && confirm("¿Está seguro de eliminar esta solicitud?")) {
        deleteLead(leadId);
        renderLeadsViews();
      }
    });
  });
}
