// DOC-021 4 (Administrador del Sistema) — conteos de plataforma, sin filtro por organizacion (es
// una vista completa por diseño). No confundir con los dashboards patrimoniales de CIP
// (cip/src/dashboard/): esto es "cuantas organizaciones/contratos/sedes existen", no datos de
// activos/inventarios.
export interface ContratosPorEstado {
  vigente: number;
  suspendido: number;
  vencido: number;
  cancelado: number;
}

export interface Indicadores {
  totalOrganizaciones: number;
  totalSedes: number;
  contratosPorEstado: ContratosPorEstado;
}
