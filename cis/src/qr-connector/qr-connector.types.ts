export interface Sede {
  id: string;
  nombre: string;
}

export interface Organizacion {
  id: string;
  nombre: string;
  // Sedes cubiertas por contrato vigente — ver ADR-002 (Organizacion -> Contrato -> Sede).
  // Este tipo no modela "Contrato" como entidad propia en CIS, solo su resultado (que sedes
  // quedan habilitadas) — la entidad Contrato vive en CORE/base-patrimonial.
  sedes: Sede[];
}

export interface AuthSessionResponse {
  accessToken: string;
  expiresAt: string;
  organizaciones: Organizacion[];
}

export interface ActivoCatalogo {
  codigoQr: string;
  nombre: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  // Etiquetas para el operador, derivadas en CORE (no son columnas de `activos`).
  areaNombre: string;
  // DOC-033 — "Dirección" (`areas.dependencia`), para el catálogo enriquecido de CCP y el
  // selector de escaneo de APP QR. Null cuando el área no la tiene cargada (cliente simple).
  areaDependencia: string | null;
  ubicacionNombre: string;
  familia: string;
  /** ISO 8601. Cuando el activo entro a la BPI. */
  incorporadoEn: string;
  estado: string;
  // DOC-033 — columnas del catálogo enriquecido de CCP, todas nullable (dependen de si el
  // Excel del cliente las trae).
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  valorPatrimonial: number | null;
  /** ISO 8601 (solo fecha, "YYYY-MM-DD"). Fecha de compra real, distinta de `incorporadoEn`. */
  fechaCompra: string | null;
  responsableNombre: string | null;
}

export interface CatalogoResponse {
  activos: ActivoCatalogo[];
  // Total de la consulta, no de la pagina: sin esto el consumidor no puede saber si hay mas
  // paginas ni mostrar un conteo real. CORE ya lo calculaba y CIS lo descartaba.
  total: number;
}

export type InventarioEstado = 'pendiente' | 'recibido' | 'rechazado';

export interface InventarioError {
  campo: string;
  detalle: string;
}

export interface PostInventarioResponse {
  inventarioId: string;
  estado: InventarioEstado;
  errores?: InventarioError[];
}

export interface InventarioEstadoResponse {
  estado: InventarioEstado;
  ultimoIntento: string;
}

// RF-04 (Fase 5, WEB) — GET /inventarios (listado) y GET /inventarios/:id (detalle).
export interface SesionResumen {
  id: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: InventarioEstado;
  creadoEn: string;
}

export interface EscaneoDetalle {
  codigoQr: string;
  resultado: string;
  observaciones: string | null;
}

export interface SesionDetalle extends SesionResumen {
  escaneos: EscaneoDetalle[];
}

// DOC-029 RF-I — informe de control de área de una sesión ("Pantalla 8"). Passthrough del
// contrato de CORE (GET /inventarios/:id/control); CIS no transforma nada.
export type TipoControl = 'ordinario' | 'extraordinario';
export type Veredicto = 'exitoso' | 'aceptable' | 'defectuoso';

export interface EscaneoControl {
  codigoQr: string;
  nombre: string | null;
  tipo: TipoControl | null;
  resultado: string;
}

export interface FueraDeAreaControl {
  codigoQr: string;
  nombre: string | null;
  tipo: TipoControl | null;
  areaRealNombre: string | null;
}

export interface FaltanteControl {
  codigoQr: string;
  nombre: string;
}

export interface ResumenControl {
  sesionId: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: InventarioEstado;
  escaneados: number;
  delArea: number;
  activosDelArea: number;
  delAreaPct: number;
  porEstadoDeclarado: {
    enServicio: number;
    enMantenimiento: number;
    inactivo: number;
    baja: number;
  };
  escaneadosLista: EscaneoControl[];
  fueraDeArea: FueraDeAreaControl[];
  faltantes: FaltanteControl[];
  veredicto: Veredicto;
}
