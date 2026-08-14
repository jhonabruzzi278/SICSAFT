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
