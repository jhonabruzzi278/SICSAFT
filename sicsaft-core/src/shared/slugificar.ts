// Mismo criterio que slugificar() en cis/src/keycloak-admin/keycloak-admin.service.ts y en
// devops/onprem/instalar-cliente.ps1 (New-DominioDesdeNombre) — un id DNS-safe/Keycloak-alias-safe
// a partir de un nombre libre. Vive en shared/ porque tanto el renderer (PasoDatosCliente.tsx, para
// sugerir el organizacionId mientras el vendedor tipea) como el proceso principal
// (keycloak-bootstrap.ts, si en algún momento necesita derivarlo de nuevo) lo usan igual.
const DIACRITICOS_COMBINANTES = new RegExp("[\\u0300-\\u036f]", "g");

export function slugificar(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(DIACRITICOS_COMBINANTES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
