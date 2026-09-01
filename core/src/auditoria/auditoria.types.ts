// DOC-011 — equipo/ip nullable: CIS no le pasa a CORE ese dato todavia (ver DOC-011 "equipo/ip:
// sin dato real en esta fase").
// DOC-024 3 — `categoria` distingue lo que ya pasaba por el Orquestador ('patrimonial', default —
// ninguna fila existente cambia de significado) de lo que CIS reporta despues de una operacion de
// identidad en Zitadel ('identidad', ver AuditoriaEscrituraController). `organizacionId` nullable:
// no todo evento tiene una organizacion puntual (ej. el propio alta de Organizacion).
export type CategoriaAuditoria = 'patrimonial' | 'identidad';

export interface RegistrarAuditoriaInput {
  usuario: string;
  equipo?: string;
  ip?: string;
  operacion: string;
  resultado: string;
  observaciones?: string;
  categoria?: CategoriaAuditoria;
  organizacionId?: string | null;
  // DOC-029 RF-E — área operativa del actor. Presente cuando la operación es sobre un área
  // concreta (hoy: `POST /inventarios`); null en el resto hasta que CIS propague el claim.
  areaOperativa?: string | null;
}

// RF-06 (Fase 5, WEB) — fila de auditoria para GET /auditoria. Mismas columnas que la tabla
// (DOC-005 7 + DOC-024 3).
export interface AuditoriaEntrada {
  id: string;
  usuario: string;
  fecha: string;
  equipo: string | null;
  ip: string | null;
  operacion: string;
  resultado: string;
  observaciones: string | null;
  categoria: CategoriaAuditoria;
  organizacionId: string | null;
  // DOC-029 RF-E.
  areaOperativa: string | null;
}

// RF-06 — filtros de GET /auditoria (cierra el gap: el requisito original pedia "filtrable por
// usuario/fecha/operacion", el primer incremento solo devolvia las 200 mas recientes sin filtro
// alguno). `usuario`/`operacion` son busqueda parcial (ILIKE), no igualdad exacta: `operacion`
// incluye el id del recurso en varias operaciones (ej. `POST /activos/${id}/baja`,
// `PATCH /responsables/${id}/estado`), asi que un filtro exacto casi nunca matchearia mas de una
// fila — parcial permite filtrar por categoria ("baja", "responsables") igual que por el string
// completo. `fechaDesde`/`fechaHasta` son ISO 8601, inclusive en ambos extremos.
export interface AuditoriaFiltro {
  usuario?: string;
  operacion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  categoria?: CategoriaAuditoria;
  organizacionId?: string;
  // DOC-029 RF-E — filtro parcial (ILIKE) por área operativa, igual que usuario/operacion. Lo usa
  // el deep-link del CCP desde una sesión de control (RF-D §D.2).
  area?: string;
  limit: number;
  offset: number;
}

// RNF-01 (cierra el gap) — GET /auditoria paginado, mismo criterio que CatalogoPagina.
export interface AuditoriaPagina {
  entradas: AuditoriaEntrada[];
  total: number;
}
