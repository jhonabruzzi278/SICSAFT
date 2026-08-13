// Forma del árbol organización→área→ubicación que usa la UI (OrganizationPicker,
// AreaLocationPicker). Hasta TASK-007 esto traía datos semilla locales — ahora se deriva en
// runtime del catálogo real de CIS (ver qr-connector.ts, buildOrganizationTree) para el flujo
// oficial. catalog-data.ts (CatalogPage.tsx, fuera de alcance de TASK-007 por decisión del
// usuario) sigue con sus propios datos locales, sin depender de este archivo.
export interface OrgLocation {
  id: string;
  name: string;
}

export interface OrgArea {
  id: string;
  name: string;
  locations: OrgLocation[];
}

export interface Organization {
  id: string;
  name: string;
  areas: OrgArea[];
}
