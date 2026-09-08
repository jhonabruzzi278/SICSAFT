/**
 * Lead Store and Google Sheets Sync Module for SICSAFT
 */

export interface DemoLead {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  organization: string;
  phone: string;
  sector: string;
  level: string;
  message?: string;
  status: "Pendiente" | "Contactado" | "Demo Agendada" | "Cerrado";
  notes?: string;
}

const STORAGE_KEY = "sicsaft_demo_leads";
const WEBHOOK_KEY = "sicsaft_google_sheets_webhook";

const INITIAL_DEMO_LEADS: DemoLead[] = [
  {
    id: "lead-1",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    name: "Carolina Valenzuela",
    email: "cvalenzuela@hospitalcentral.cl",
    organization: "Hospital Clínico Regional",
    phone: "+56 9 8765 4321",
    sector: "salud",
    level: "nivel-3",
    message: "Requerimos control de activos biomédicos y trazabilidad en quirófanos con RFID.",
    status: "Pendiente",
  },
  {
    id: "lead-2",
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    name: "Rodrigo Morales",
    email: "rmorales@munivalpo.cl",
    organization: "Ilustre Municipalidad",
    phone: "+56 9 7654 3210",
    sector: "gobierno",
    level: "nivel-2",
    message: "Levantamiento de inventario de mobiliario e infraestructura comunal.",
    status: "Contactado",
    notes: "Llamada inicial realizada. Coordinando reunión con el departamento de finanzas.",
  },
  {
    id: "lead-3",
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    name: "Ignacio Tapia",
    email: "itapia@mineraandes.com",
    organization: "Minera Los Andes SpA",
    phone: "+56 9 6543 2109",
    sector: "industria",
    level: "nivel-3",
    message: "Control de repuestos y maquinaria pesada en faena cordillerana.",
    status: "Demo Agendada",
    notes: "Demo fijada para el próximo martes a las 10:30 hrs.",
  },
];

export function getLeads(): DemoLead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_LEADS));
      return INITIAL_DEMO_LEADS;
    }
    return JSON.parse(raw) as DemoLead[];
  } catch {
    return INITIAL_DEMO_LEADS;
  }
}

export function saveLead(
  data: Omit<DemoLead, "id" | "createdAt" | "status">
): DemoLead {
  const leads = getLeads();
  const newLead: DemoLead = {
    ...data,
    id: "lead-" + Date.now(),
    createdAt: new Date().toISOString(),
    status: "Pendiente",
  };

  leads.unshift(newLead);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));

  // Sync to Google Sheets / Webhook in background
  syncToGoogleSheets(newLead).catch((err) =>
    console.warn("Google Sheets sync warning:", err)
  );

  return newLead;
}

export function updateLeadStatus(
  id: string,
  status: DemoLead["status"]
): void {
  const leads = getLeads().map((l) => (l.id === id ? { ...l, status } : l));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

export function updateLeadNotes(id: string, notes: string): void {
  const leads = getLeads().map((l) => (l.id === id ? { ...l, notes } : l));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

export function deleteLead(id: string): void {
  const leads = getLeads().filter((l) => l.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}

export function getWebhookUrl(): string {
  return localStorage.getItem(WEBHOOK_KEY) || "";
}

export function setWebhookUrl(url: string): void {
  localStorage.setItem(WEBHOOK_KEY, url.trim());
}

export async function syncToGoogleSheets(lead: DemoLead): Promise<boolean> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) return false;

  try {
    const payload = {
      id: lead.id,
      fecha: new Date(lead.createdAt).toLocaleString("es-CL"),
      nombre: lead.name,
      email: lead.email,
      organizacion: lead.organization,
      telefono: lead.phone,
      sector: lead.sector,
      nivel: lead.level,
      mensaje: lead.message || "",
      estado: lead.status,
    };

    // Send POST request with mode no-cors for Google Apps Script Webhooks
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "no-cors",
    });

    return true;
  } catch (error) {
    console.error("Failed to sync lead to Google Sheets webhook:", error);
    return false;
  }
}

export function exportLeadsToCSV(): void {
  const leads = getLeads();
  if (!leads.length) return;

  const headers = [
    "ID",
    "Fecha",
    "Nombre",
    "Correo",
    "Organización",
    "Teléfono",
    "Sector",
    "Nivel",
    "Estado",
    "Mensaje",
    "Notas",
  ];

  const rows = leads.map((l) => [
    l.id,
    new Date(l.createdAt).toLocaleString("es-CL"),
    `"${(l.name || "").replace(/"/g, '""')}"`,
    `"${(l.email || "").replace(/"/g, '""')}"`,
    `"${(l.organization || "").replace(/"/g, '""')}"`,
    `"${(l.phone || "").replace(/"/g, '""')}"`,
    `"${l.sector}"`,
    `"${l.level}"`,
    `"${l.status}"`,
    `"${(l.message || "").replace(/"/g, '""')}"`,
    `"${(l.notes || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8,\uFEFF" +
    [headers.join(";"), ...rows.map((e) => e.join(";"))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute(
    "download",
    `sicsaft_solicitudes_demo_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
