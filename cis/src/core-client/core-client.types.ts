import { z } from 'zod';

// Contrato de GET /entitlements de CORE — ver base-patrimonial/DOC-004-modelo-contrato.md 6.
// Se valida la respuesta acá porque CORE es un limite de confianza (proceso/red distintos, ver
// coding-style: "validar en los limites del sistema"), no porque se desconfie del codigo propio.
const sedeSchema = z.object({
  id: z.string(),
  nombre: z.string(),
});

const organizacionSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  sedes: z.array(sedeSchema),
});

export const entitlementsResponseSchema = z.object({
  organizaciones: z.array(organizacionSchema),
});

export type EntitlementsResult = z.infer<typeof entitlementsResponseSchema>;

// Contrato de GET /catalogo de CORE — ver core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md
// 2. CORE pagina (`total`), pero el contrato ya construido con APP QR (DOC-002) no expone
// paginacion todavia — CoreClientService devuelve solo `activos`, sin cambiar CatalogoResponse.
const activoCatalogoSchema = z.object({
  // DOC-021 3 — necesario para las acciones nuevas por fila en WEB (baja/reincorporación/
  // responsable/descripción son por :id, no por codigoQr).
  id: z.string(),
  codigoQr: z.string(),
  nombre: z.string(),
  organizacionId: z.string(),
  areaId: z.string(),
  ubicacionId: z.string(),
  estado: z.string(),
});

export const catalogoResponseSchema = z.object({
  activos: z.array(activoCatalogoSchema),
  total: z.number(),
});
export type CatalogoResult = z.infer<typeof catalogoResponseSchema>;

// Contrato de POST /inventarios y GET /inventarios/:id/estado de CORE — DOC-006 3/4.
export const postInventarioResponseSchema = z.object({
  inventarioId: z.string(),
  estado: z.enum(['pendiente', 'recibido', 'rechazado']),
});
export type PostInventarioResult = z.infer<typeof postInventarioResponseSchema>;

export const inventarioEstadoResponseSchema = z.object({
  estado: z.enum(['pendiente', 'recibido', 'rechazado']),
  ultimoIntento: z.string(),
});
export type InventarioEstadoResult = z.infer<
  typeof inventarioEstadoResponseSchema
>;

// Contrato de POST /activos de CORE — DOC-012 5. `PostActivoRequest` es lo que CIS le manda a
// CORE (ya con `operadorId`/`rolesPorOrganizacion` resueltos, ver AdministradorService), no lo
// que WEB le manda a CIS (ese es AltaActivoBody, forma mas chica — sin esos dos campos).
export interface PostActivoRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
  descripcion?: string;
}

// Contrato de POST /contratos y PATCH /contratos/:id de CORE — DOC-012 7. Mismo criterio que
// PostActivoRequest: CIS ya resolvio operadorId/rolesPorOrganizacion antes de armar esto.
export interface PostContratoRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  sedeIds: string[];
  vigenciaDesde: string;
  vigenciaHasta?: string | null;
  modulosContratados: string[];
}

export interface PatchContratoRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  estado: string;
}

const sedeContratoSchema = z.object({ id: z.string(), nombre: z.string() });

export const contratoResponseSchema = z.object({
  id: z.string(),
  organizacionId: z.string(),
  organizacionNombre: z.string(),
  sedes: z.array(sedeContratoSchema),
  vigenciaDesde: z.string(),
  vigenciaHasta: z.string().nullable(),
  estado: z.enum(['vigente', 'suspendido', 'vencido', 'cancelado']),
  modulosContratados: z.array(z.string()),
});
export type ContratoResult = z.infer<typeof contratoResponseSchema>;

// RNF-01 (cierra el gap) — GET /contratos paginado, mismo criterio que CatalogoResult.
export const contratosPaginaResponseSchema = z.object({
  contratos: z.array(contratoResponseSchema),
  total: z.number(),
});
export type ContratosPaginaResult = z.infer<
  typeof contratosPaginaResponseSchema
>;

// RNF-01 — limit/offset, mismos defaults que el resto de listados paginados (20/tope 100, ver
// core/src/patrimonial/catalogo.schemas.ts).
export interface Paginacion {
  limit?: number;
  offset?: number;
}

// RF-04 (Fase 5, WEB) — GET /inventarios (listado) y GET /inventarios/:id (detalle) de CORE.
const sesionResumenSchema = z.object({
  id: z.string(),
  organizacionId: z.string(),
  areaId: z.string(),
  ubicacionId: z.string(),
  operadorId: z.string(),
  fechaInicio: z.string(),
  fechaCierre: z.string(),
  estado: z.enum(['pendiente', 'recibido', 'rechazado']),
  creadoEn: z.string(),
});
export type SesionResumenResult = z.infer<typeof sesionResumenSchema>;
export const sesionesResumenResponseSchema = z.array(sesionResumenSchema);

export const sesionDetalleResponseSchema = sesionResumenSchema.extend({
  escaneos: z.array(
    z.object({
      codigoQr: z.string(),
      resultado: z.string(),
      observaciones: z.string().nullable(),
    }),
  ),
});
export type SesionDetalleResult = z.infer<typeof sesionDetalleResponseSchema>;

// RF-06 (Fase 5, WEB) — contrato de GET /auditoria de CORE. Sin organizacionId (ver
// core/src/auditoria/auditoria.types.ts): la tabla audita cualquier operacion del ecosistema.
const auditoriaEntradaSchema = z.object({
  id: z.string(),
  usuario: z.string(),
  fecha: z.string(),
  equipo: z.string().nullable(),
  ip: z.string().nullable(),
  operacion: z.string(),
  resultado: z.string(),
  observaciones: z.string().nullable(),
});
export type AuditoriaEntradaResult = z.infer<typeof auditoriaEntradaSchema>;

// RNF-01 (cierra el gap) — GET /auditoria paginado.
export const auditoriaPaginaResponseSchema = z.object({
  entradas: z.array(auditoriaEntradaSchema),
  total: z.number(),
});
export type AuditoriaPaginaResult = z.infer<
  typeof auditoriaPaginaResponseSchema
>;

// RF-06 — filtros de GET /auditoria (cierra el gap: el requisito pedia "filtrable por
// usuario/fecha/operacion"). Mismo shape que core/src/auditoria/auditoria.types.ts AuditoriaFiltro
// (mas limit/offset, RNF-01).
export interface AuditoriaFiltro extends Paginacion {
  usuario?: string;
  operacion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

// RF-05 (Fase 5, WEB) — contrato de Area/Ubicacion/Responsable de CORE (DOC-005 2/3).
export const areaResponseSchema = z.object({
  id: z.string(),
  organizacionId: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  dependencia: z.string().nullable(),
  centroCosto: z.string().nullable(),
  responsableId: z.string().nullable(),
  ubicacionPrincipalId: z.string().nullable(),
});
export type AreaResult = z.infer<typeof areaResponseSchema>;

// RNF-01 (cierra el gap) — GET /areas paginado.
export const areasPaginaResponseSchema = z.object({
  areas: z.array(areaResponseSchema),
  total: z.number(),
});
export type AreasPaginaResult = z.infer<typeof areasPaginaResponseSchema>;

export interface PostAreaRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  codigo: string;
  nombre: string;
  dependencia?: string;
  centroCosto?: string;
}

// RF-05 (cierra el gap "ABM completo") — PATCH /areas/:id.
export interface PatchAreaRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  codigo?: string;
  nombre?: string;
  dependencia?: string;
  centroCosto?: string;
  responsableId?: string;
  ubicacionPrincipalId?: string;
}

export const ubicacionResponseSchema = z.object({
  id: z.string(),
  sedeId: z.string(),
  edificio: z.string().nullable(),
  piso: z.string().nullable(),
  areaId: z.string().nullable(),
  oficina: z.string().nullable(),
  dependencia: z.string().nullable(),
});
export type UbicacionResult = z.infer<typeof ubicacionResponseSchema>;

// RNF-01 (cierra el gap) — GET /ubicaciones paginado.
export const ubicacionesPaginaResponseSchema = z.object({
  ubicaciones: z.array(ubicacionResponseSchema),
  total: z.number(),
});
export type UbicacionesPaginaResult = z.infer<
  typeof ubicacionesPaginaResponseSchema
>;

export interface PostUbicacionRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  sedeId: string;
  edificio?: string;
  piso?: string;
  areaId?: string;
  oficina?: string;
  dependencia?: string;
}

// RF-05 (cierra el gap "ABM completo") — PATCH /ubicaciones/:id. Sin sedeId (mover de sede es un
// traslado, fuera de alcance).
export interface PatchUbicacionRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  edificio?: string;
  piso?: string;
  areaId?: string;
  oficina?: string;
  dependencia?: string;
}

export const responsableResponseSchema = z.object({
  id: z.string(),
  identificacion: z.string(),
  nombre: z.string(),
  cargo: z.string().nullable(),
  areaId: z.string(),
  correo: z.string().nullable(),
  telefono: z.string().nullable(),
  estado: z.enum(['activo', 'inactivo']),
});
export type ResponsableResult = z.infer<typeof responsableResponseSchema>;

// RNF-01 (cierra el gap) — GET /responsables paginado.
export const responsablesPaginaResponseSchema = z.object({
  responsables: z.array(responsableResponseSchema),
  total: z.number(),
});
export type ResponsablesPaginaResult = z.infer<
  typeof responsablesPaginaResponseSchema
>;

export interface PostResponsableRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  identificacion: string;
  nombre: string;
  cargo?: string;
  areaId: string;
  correo?: string;
  telefono?: string;
}

export interface PatchResponsableEstadoRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  estado: 'activo' | 'inactivo';
}

export const activoResponseSchema = z.object({
  id: z.string(),
  codigoPatrimonial: z.string(),
  codigoQr: z.string(),
  organizacionId: z.string(),
  areaId: z.string().nullable(),
  ubicacionId: z.string().nullable(),
  responsableId: z.string().nullable(),
  estado: z.enum(['activo', 'en_transito', 'extraviado', 'dado_de_baja']),
  // DOC-021 3 (gap "descripciones").
  descripcion: z.string().nullable(),
  catalogo: z.object({
    tipo: z.string(),
    familia: z.string(),
    subfamilia: z.string().nullable(),
    marca: z.string().nullable(),
    modelo: z.string().nullable(),
  }),
});
export type ActivoResult = z.infer<typeof activoResponseSchema>;

// DOC-021 3 (gap "estados" de Activo) — base compartida por baja/reincorporacion (identica a
// EscrituraOficialRequest de CORE, activo.schemas.ts: sin campos propios mas alla del contexto de
// autorizacion).
export interface EscrituraOficialRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
}

export interface PatchActivoResponsableRequest extends EscrituraOficialRequest {
  responsableId: string;
}

// `descripcion: null` limpia el campo (a diferencia de omitirlo) — mismo criterio que CORE.
export interface PatchActivoDescripcionRequest extends EscrituraOficialRequest {
  descripcion: string | null;
}

// DOC-021 4 (gap "familias/categorías") — catalogo_activos, no ActivoCatalogo (activoCatalogoSchema
// arriba, listado de activos que consume APP QR).
export const catalogoTipoResponseSchema = z.object({
  id: z.string(),
  tipo: z.string(),
  familia: z.string(),
  subfamilia: z.string().nullable(),
  marca: z.string().nullable(),
  modelo: z.string().nullable(),
  fabricante: z.string().nullable(),
  vidaUtilMeses: z.number().nullable(),
  criticidad: z.enum(['baja', 'media', 'alta']),
  tecnologiaIdentificacion: z.enum(['qr', 'rfid', 'qr_rfid']),
});
export type CatalogoTipoResult = z.infer<typeof catalogoTipoResponseSchema>;
export const catalogoTiposResponseSchema = z.array(catalogoTipoResponseSchema);

export interface PostCatalogoTipoRequest extends EscrituraOficialRequest {
  tipo: string;
  familia: string;
  subfamilia?: string;
  marca?: string;
  modelo?: string;
  fabricante?: string;
  vidaUtilMeses?: number;
  criticidad: 'baja' | 'media' | 'alta';
  tecnologiaIdentificacion: 'qr' | 'rfid' | 'qr_rfid';
}

// DOC-021 3 (gap "documentación y fotografías", version minima — url externa, sin bucket/OCR
// propio todavia, ver ROADMAP.md Fase 7).
export const documentoActivoResponseSchema = z.object({
  id: z.string(),
  activoId: z.string(),
  organizacionId: z.string(),
  tipo: z.enum(['documento', 'fotografia']),
  url: z.string(),
  descripcion: z.string().nullable(),
  creadoEn: z.string(),
  creadoPor: z.string(),
});
export type DocumentoActivoResult = z.infer<
  typeof documentoActivoResponseSchema
>;
export const documentosActivoResponseSchema = z.array(
  documentoActivoResponseSchema,
);

export interface PostDocumentoActivoRequest extends EscrituraOficialRequest {
  tipo: 'documento' | 'fotografia';
  url: string;
  descripcion?: string;
}

// DOC-021 4 (Administrador del Sistema) — `organizaciones` ya existia (Fase 0), sin
// repository/endpoint propio hasta este incremento.
export const organizacionResponseSchema = z.object({
  id: z.string(),
  nombre: z.string(),
});
export type OrganizacionResult = z.infer<typeof organizacionResponseSchema>;
export const organizacionesResponseSchema = z.array(organizacionResponseSchema);

// DOC-022 3 — sin `organizacionId` a propósito, a diferencia del resto de
// EscrituraOficialRequest: el rol administrador-sistema se verifica en cualquier organización
// del token, no en una puntual (ver core/src/entitlements/organizacion.schemas.ts).
export interface PostOrganizacionRequest {
  correlationId: string;
  operadorId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  id: string;
  nombre: string;
}

// DOC-021 4 — conteos de plataforma, sin auditoria (lectura abierta en CORE).
export const indicadoresResponseSchema = z.object({
  totalOrganizaciones: z.number(),
  totalSedes: z.number(),
  contratosPorEstado: z.object({
    vigente: z.number(),
    suspendido: z.number(),
    vencido: z.number(),
    cancelado: z.number(),
  }),
});
export type IndicadoresResult = z.infer<typeof indicadoresResponseSchema>;

// DOC-012 6 (gap "importaciones controladas") — CORE ya lo implementaba, sin puente en CIS hasta
// este incremento.
export interface FilaImportacionContable {
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
}

export interface PostImportacionContableRequest extends EscrituraOficialRequest {
  filas: FilaImportacionContable[];
}

const resultadoFilaImportacionSchema = z.object({
  codigoPatrimonial: z.string(),
  resultado: z.enum(['creado', 'ya_importado', 'conflicto']),
  motivo: z.string().optional(),
});

export const importacionContableResponseSchema = z.object({
  filas: z.array(resultadoFilaImportacionSchema),
  creados: z.number(),
  yaImportados: z.number(),
  conflictos: z.number(),
});
export type ImportacionContableResult = z.infer<
  typeof importacionContableResponseSchema
>;
