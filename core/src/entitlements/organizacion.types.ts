// DOC-021 4 (Administrador del Sistema) — `organizaciones` ya existia desde la Fase 0
// (migracion 1755000000000), cache de lectura del org_id/nombre que administra Zitadel (DOC-004
// 2), pero sin repository/endpoint propio — solo se leia via JOIN dentro de ContratoRepository.
export interface Organizacion {
  id: string;
  nombre: string;
}

export interface NuevaOrganizacionInput {
  id: string;
  nombre: string;
}
