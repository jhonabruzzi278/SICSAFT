import { z } from 'zod';

// RNF-01 — limit/offset compartido por todos los listados, mismos defaults que CORE
// (core/src/estructura/estructura.schemas.ts).
const paginacionSchema = {
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
};

// DOC-012 5 — lo que WEB manda a CIS. Mas chico que PostActivoRequest (core-client.types.ts):
// `operadorId`/`rolesPorOrganizacion` los resuelve CIS a partir del access token ya validado
// (KeycloakAuthGuard), nunca se confian desde el body de un cliente de navegador.
export const altaActivoSchema = z.object({
  organizacionId: z.string().min(1),
  codigoPatrimonial: z.string().min(1),
  codigoQr: z.string().min(1),
  catalogoId: z.string().min(1),
  serie: z.string().min(1).optional(),
  responsableId: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
  valorPatrimonial: z.number().nonnegative().optional(),
  descripcion: z.string().min(1).optional(),
});
export type AltaActivoBody = z.infer<typeof altaActivoSchema>;

// DOC-021 3 (gap "estados") — lo que WEB manda a CIS para baja/reincorporacion/responsable. Sin
// payload propio mas alla de organizacionId — mismo criterio que escrituraOficialSchema en CORE.
export const escrituraOficialActivoSchema = z.object({
  organizacionId: z.string().min(1),
});
export type EscrituraOficialActivoBody = z.infer<
  typeof escrituraOficialActivoSchema
>;

export const cambioResponsableActivoSchema = z.object({
  organizacionId: z.string().min(1),
  responsableId: z.string().min(1),
});
export type CambioResponsableActivoBody = z.infer<
  typeof cambioResponsableActivoSchema
>;

// `descripcion: null` limpia el campo.
export const actualizarDescripcionActivoSchema = z.object({
  organizacionId: z.string().min(1),
  descripcion: z.string().min(1).nullable(),
});
export type ActualizarDescripcionActivoBody = z.infer<
  typeof actualizarDescripcionActivoSchema
>;

// DOC-021 4 (gap "familias/categorías").
export const altaCatalogoTipoSchema = z.object({
  organizacionId: z.string().min(1),
  tipo: z.string().min(1),
  familia: z.string().min(1),
  subfamilia: z.string().min(1).optional(),
  marca: z.string().min(1).optional(),
  modelo: z.string().min(1).optional(),
  fabricante: z.string().min(1).optional(),
  vidaUtilMeses: z.number().int().positive().optional(),
  criticidad: z.enum(['baja', 'media', 'alta']),
  tecnologiaIdentificacion: z.enum(['qr', 'rfid', 'qr_rfid']),
});
export type AltaCatalogoTipoBody = z.infer<typeof altaCatalogoTipoSchema>;

// DOC-021 3 (gap "documentación y fotografías").
export const altaDocumentoActivoSchema = z.object({
  organizacionId: z.string().min(1),
  tipo: z.enum(['documento', 'fotografia']),
  url: z.string().url(),
  descripcion: z.string().min(1).optional(),
});
export type AltaDocumentoActivoBody = z.infer<typeof altaDocumentoActivoSchema>;

export const documentosActivoQuerySchema = z.object({
  organizacionId: z.string().min(1),
});
export type DocumentosActivoQuery = z.infer<typeof documentosActivoQuerySchema>;

// DOC-012 6 (gap "importaciones controladas").
const filaImportacionContableSchema = z.object({
  codigoPatrimonial: z.string().min(1),
  codigoQr: z.string().min(1),
  catalogoId: z.string().min(1),
  serie: z.string().min(1).optional(),
  responsableId: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
  valorPatrimonial: z.number().nonnegative().optional(),
});
export const importacionContableSchema = z.object({
  organizacionId: z.string().min(1),
  filas: z.array(filaImportacionContableSchema).min(1),
});
export type ImportacionContableBody = z.infer<typeof importacionContableSchema>;

// DOC-029 RF-B — bandeja de staging. El cuerpo NO trae operadorId/rolesPorOrganizacion/
// correlationId: se inyectan del JWT en AdministradorService (mismo patrón que el resto). Cada
// fila trae los ids que el ETL ya pudo resolver y/o los nombres tal cual del Excel — CORE
// resuelve-o-crea lo que falte al aprobar (por eso `catalogoId` es opcional acá).
const filaLoteImportacionContableSchema = filaImportacionContableSchema
  .extend({
    linea: z.number().int().positive(),
    catalogoId: z.string().min(1).optional(),
    direccionNombre: z.string().min(1).optional(),
    areaNombre: z.string().min(1).optional(),
    responsableNombre: z.string().min(1).optional(),
    categoriaNombre: z.string().min(1).optional(),
    nombreAft: z.string().min(1).optional(),
    crudo: z.record(z.string(), z.string()).default({}),
  })
  .refine((f) => Boolean(f.catalogoId ?? f.categoriaNombre), {
    message: 'cada fila necesita catalogoId o categoriaNombre',
    path: ['catalogoId'],
  });
export const crearLoteImportacionContableSchema = z.object({
  organizacionId: z.string().min(1),
  origen: z.enum(['carpeta', 'manual']),
  archivoNombre: z.string().min(1).optional(),
  filas: z.array(filaLoteImportacionContableSchema).min(1),
});
export type CrearLoteImportacionContableBody = z.infer<
  typeof crearLoteImportacionContableSchema
>;

export const listarLotesImportacionContableQuerySchema = z.object({
  organizacionId: z.string().min(1),
  estado: z.enum(['pendiente_revision', 'aprobado', 'rechazado']).optional(),
});
export type ListarLotesImportacionContableQuery = z.infer<
  typeof listarLotesImportacionContableQuerySchema
>;

export const aprobarLoteImportacionContableSchema = z.object({
  organizacionId: z.string().min(1),
});
export type AprobarLoteImportacionContableBody = z.infer<
  typeof aprobarLoteImportacionContableSchema
>;

export const rechazarLoteImportacionContableSchema = z.object({
  organizacionId: z.string().min(1),
  motivo: z.string().min(1).optional(),
});
export type RechazarLoteImportacionContableBody = z.infer<
  typeof rechazarLoteImportacionContableSchema
>;

// RF-05 (Fase 5) — lo que WEB manda a CIS para POST /admin/areas/ubicaciones/responsables. Mismo
// criterio que altaActivoSchema: operadorId/rolesPorOrganizacion los resuelve CIS, nunca el body.
export const altaAreaSchema = z.object({
  organizacionId: z.string().min(1),
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  dependencia: z.string().min(1).optional(),
  centroCosto: z.string().min(1).optional(),
});
export type AltaAreaBody = z.infer<typeof altaAreaSchema>;

// RF-05 (cierra el gap "ABM completo") — lo que WEB manda a CIS para PATCH /admin/areas/:id.
// Todos opcionales, `.refine` exige al menos uno (mismo criterio que CORE, estructura.schemas.ts
// — se repite acá porque CIS valida su propio contrato con WEB, distinto del contrato con CORE).
export const actualizarAreaSchema = z
  .object({
    organizacionId: z.string().min(1),
    codigo: z.string().min(1).optional(),
    nombre: z.string().min(1).optional(),
    dependencia: z.string().min(1).optional(),
    centroCosto: z.string().min(1).optional(),
    responsableId: z.string().min(1).optional(),
    ubicacionPrincipalId: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.codigo !== undefined ||
      data.nombre !== undefined ||
      data.dependencia !== undefined ||
      data.centroCosto !== undefined ||
      data.responsableId !== undefined ||
      data.ubicacionPrincipalId !== undefined,
    { message: 'Debe incluir al menos un campo a actualizar' },
  );
export type ActualizarAreaBody = z.infer<typeof actualizarAreaSchema>;

export const areasQuerySchema = z.object({
  organizacionId: z.string().min(1),
  ...paginacionSchema,
});
export type AreasQuery = z.infer<typeof areasQuerySchema>;

export const altaUbicacionSchema = z.object({
  organizacionId: z.string().min(1),
  sedeId: z.string().min(1),
  edificio: z.string().min(1).optional(),
  piso: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  oficina: z.string().min(1).optional(),
  dependencia: z.string().min(1).optional(),
});
export type AltaUbicacionBody = z.infer<typeof altaUbicacionSchema>;

// RF-05 (cierra el gap "ABM completo") — PATCH /admin/ubicaciones/:id. Sin `sedeId` (mover de
// sede es un traslado, fuera de alcance — mismo criterio que CORE).
export const actualizarUbicacionSchema = z
  .object({
    organizacionId: z.string().min(1),
    edificio: z.string().min(1).optional(),
    piso: z.string().min(1).optional(),
    areaId: z.string().min(1).optional(),
    oficina: z.string().min(1).optional(),
    dependencia: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.edificio !== undefined ||
      data.piso !== undefined ||
      data.areaId !== undefined ||
      data.oficina !== undefined ||
      data.dependencia !== undefined,
    { message: 'Debe incluir al menos un campo a actualizar' },
  );
export type ActualizarUbicacionBody = z.infer<typeof actualizarUbicacionSchema>;

export const ubicacionesQuerySchema = z.object({
  sedeId: z.string().min(1),
  ...paginacionSchema,
});
export type UbicacionesQuery = z.infer<typeof ubicacionesQuerySchema>;

export const altaResponsableSchema = z.object({
  organizacionId: z.string().min(1),
  identificacion: z.string().min(1),
  nombre: z.string().min(1),
  cargo: z.string().min(1).optional(),
  areaId: z.string().min(1),
  correo: z.string().email().optional(),
  telefono: z.string().min(1).optional(),
});
export type AltaResponsableBody = z.infer<typeof altaResponsableSchema>;

export const responsablesQuerySchema = z.object({
  areaId: z.string().min(1),
  ...paginacionSchema,
});
export type ResponsablesQuery = z.infer<typeof responsablesQuerySchema>;

export const actualizarEstadoResponsableSchema = z.object({
  organizacionId: z.string().min(1),
  estado: z.enum(['activo', 'inactivo']),
});
export type ActualizarEstadoResponsableBody = z.infer<
  typeof actualizarEstadoResponsableSchema
>;

// RF-06 — filtros de GET /admin/auditoria, todos opcionales (cierra el gap: el requisito pedia
// "filtrable por usuario/fecha/operacion").
export const auditoriaQuerySchema = z.object({
  usuario: z.string().min(1).optional(),
  operacion: z.string().min(1).optional(),
  fechaDesde: z.string().min(1).optional(),
  fechaHasta: z.string().min(1).optional(),
  // DOC-029 RF-E — filtro parcial por área operativa del actor.
  area: z.string().min(1).optional(),
  ...paginacionSchema,
});
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;
