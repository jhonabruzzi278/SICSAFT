// DOC-011 — equipo/ip nullable: CIS no le pasa a CORE ese dato todavia (ver DOC-011 § "equipo/ip:
// sin dato real en esta fase").
export interface RegistrarAuditoriaInput {
  usuario: string;
  equipo?: string;
  ip?: string;
  operacion: string;
  resultado: string;
  observaciones?: string;
}

// RF-06 (Fase 5, WEB) — fila de auditoria para GET /auditoria. Mismas columnas que la tabla
// (DOC-005 §7), sin organizacionId: la tabla audita cualquier operacion del ecosistema, no solo
// las que tocan una organizacion (ver AuditoriaRepository.listar).
export interface AuditoriaEntrada {
  id: string;
  usuario: string;
  fecha: string;
  equipo: string | null;
  ip: string | null;
  operacion: string;
  resultado: string;
  observaciones: string | null;
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
  limit: number;
  offset: number;
}

// RNF-01 (cierra el gap) — GET /auditoria paginado, mismo criterio que CatalogoPagina.
export interface AuditoriaPagina {
  entradas: AuditoriaEntrada[];
  total: number;
}
