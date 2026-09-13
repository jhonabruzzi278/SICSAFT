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
}

export interface FueraDeAreaResponse {
  codigoQr: string;
  areaRealId: string;
  areaEsperadaId: string;
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

export interface Pagina<T> {
  items: T[];
  total: number;
}
