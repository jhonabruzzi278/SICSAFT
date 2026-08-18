// Copia local de los tipos de respuesta de CORE que CIP consume (core/src/patrimonial/activo.types.ts,
// core/src/inventarios/inventarios.types.ts, core/src/inventarios/sesion-inventario.repository.ts)
// — mismo criterio ya aceptado entre CIS y CORE (cis/src/core-client/core-client.types.ts): no
// hay paquete compartido entre desplegables todavia (WAF 1, cada nivel es su propio
// desplegable).

export type EstadoActivo =
  | 'activo'
  | 'en_transito'
  | 'extraviado'
  | 'mantenimiento'
  | 'inactivo'
  | 'dado_de_baja';

// DOC-018 2.6 — `familia` es la extension aditiva que este mismo incremento agrega a CORE
// (core/src/patrimonial/activo.types.ts), necesaria para RF-09.
export interface ActivoCatalogo {
  codigoQr: string;
  nombre: string;
  familia: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  estado: EstadoActivo;
}

export interface CatalogoPagina {
  activos: ActivoCatalogo[];
  total: number;
}

export type ScanResultado =
  | 'correcto'
  | 'otra_area'
  | 'otra_ubicacion'
  | 'no_registrado'
  | 'invalido'
  | 'duplicado'
  | 'ya_escaneado'
  | 'con_incidencia';

// DOC-018 2.5 — sin `activoId`: GET /inventarios/:id no lo expone, CIP identifica activos por
// `codigoQr`.
export interface EscaneoDetalle {
  codigoQr: string;
  resultado: ScanResultado;
  observaciones: string | null;
}

export type SesionEstado = 'pendiente' | 'recibido' | 'rechazado';

export interface SesionDetalle {
  id: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: SesionEstado;
  creadoEn: string;
  escaneos: EscaneoDetalle[];
}
