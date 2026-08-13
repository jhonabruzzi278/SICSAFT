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
