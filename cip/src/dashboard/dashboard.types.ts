// DOC-018 6 — formas de respuesta de la API de lectura de CIP.

export interface SyncInfo {
  actualizadoEn: string | null;
  alDia: boolean;
}

export interface CoberturaResponse extends SyncInfo {
  activosRegistrados: number;
  activosEscaneados: number;
  porcentajeCobertura: number;
}

export interface ControlAreaResponse {
  areaId: string;
  controladaEnPeriodo: boolean;
  ultimaSesionEn: string | null;
}

export interface VeredictoSesionResponse {
  sesionId: string;
  areaId: string;
  veredicto: string;
  fechaCierre: string;
  revisado: boolean;
  revisadoPor: string | null;
  revisadoEn: string | null;
}

// DOC-034 Parte A — sesionId/veredicto agregados para entrelazar la alerta con el reporte
// (sesión de control) que la generó.
export interface FueraDeAreaResponse {
  codigoQr: string;
  sesionId: string;
  areaRealId: string;
  areaEsperadaId: string;
  veredicto: string;
  detectadoEn: string;
}

export interface NoLocalizadoResponse {
  codigoQr: string;
  desdeEn: string;
}

export interface IncidenciaResponse {
  sesionId: string;
  codigoQr: string;
  observaciones: string;
  fecha: string;
}

export interface EstadoResumenResponse {
  estado: string;
  cantidad: number;
}

export interface CategoriaResumenResponse {
  areaId: string;
  familia: string;
  cantidad: number;
}

export interface VeredictoResumenResponse {
  veredicto: string;
  cantidad: number;
}

// RF-01 (extensión "Resumen" del CIP) — el mismo `veredicto_sesion` que ya sirve `sesiones`,
// agrupado por veredicto en dos ventanas: hoy ("dia", para el control diario) y sin filtro de
// fecha ("acumulado", historico completo de la organización). `total` es la suma de `cantidad` de
// cada ventana, no un COUNT(*) aparte — evita una tercera consulta para un numero derivable.
export interface ResumenVeredictosResponse {
  dia: { total: number; porVeredicto: VeredictoResumenResponse[] };
  acumulado: { total: number; porVeredicto: VeredictoResumenResponse[] };
}

// DOC-034 Parte B — un corte diario del historial (resumen_diario), poblado por
// ResumenDiarioScheduler.
export interface ResumenDiarioResponse {
  fecha: string;
  totalSesiones: number;
  exitoso: number;
  aceptable: number;
  defectuoso: number;
}

export interface Pagina<T> {
  items: T[];
  total: number;
}
