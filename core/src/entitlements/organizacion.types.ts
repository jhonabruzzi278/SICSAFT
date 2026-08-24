// DOC-021 4 (Administrador del Sistema) — `organizaciones` ya existia desde la Fase 0
// (migracion 1755000000000), cache de lectura del org_id/nombre que administra Zitadel (DOC-004
// 2), pero sin repository/endpoint propio — solo se leia via JOIN dentro de ContratoRepository.
// DOC-024 1 — `estado` es bookkeeping de CORE, nunca cascada a Zitadel ni a Contrato (ver DOC-024
// 1): desactivar una organizacion no invalida sus contratos existentes.
export type EstadoOrganizacion = 'activo' | 'inactivo';

export interface Organizacion {
  id: string;
  nombre: string;
  estado: EstadoOrganizacion;
}

export interface NuevaOrganizacionInput {
  id: string;
  nombre: string;
}
