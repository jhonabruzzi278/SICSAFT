import { z } from 'zod';

// DOC-006 §3 — mismo schema que inventarioRequestSchema de CIS
// (cis/src/qr-connector/qr-connector.schemas.ts). Se duplica acá (sin paquete compartido entre
// CIS y CORE todavia, mismo caso ya documentado para Organizacion/Sede) — si uno cambia, el otro
// debe actualizarse a mano.
export const scanResultadoSchema = z.enum([
  'correcto',
  'otra_area',
  'otra_ubicacion',
  'no_registrado',
  'invalido',
  'duplicado',
  'ya_escaneado',
  'con_incidencia',
]);

// Fase 3.1/DOC-017, DOC-012 §5.1 — declarable sin rol administrador-patrimonial.
export const estadoOperativoDeclarableSchema = z.enum([
  'activo',
  'mantenimiento',
  'inactivo',
]);

const bajaSugeridaSchema = z.object({
  motivo: z.string().min(1),
});

const escaneoSchema = z.object({
  codigoQr: z.string().min(1),
  resultado: scanResultadoSchema,
  estadoDeclarado: estadoOperativoDeclarableSchema.optional(),
  bajaSugerida: bajaSugeridaSchema.optional(),
});

const incidenciaSchema = z.object({
  codigoQr: z.string().min(1),
  descripcion: z.string().min(1),
});

export const inventarioRequestSchema = z.object({
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  operadorId: z.string().min(1),
  organizacionId: z.string().min(1),
  areaId: z.string().min(1),
  ubicacionId: z.string().min(1),
  fechaInicio: z.string().min(1),
  fechaCierre: z.string().min(1),
  escaneos: z.array(escaneoSchema),
  incidencias: z.array(incidenciaSchema),
});
export type InventarioRequestBody = z.infer<typeof inventarioRequestSchema>;

export const inventarioEstadoParamsSchema = z.object({
  inventarioId: z.string().min(1),
});
export type InventarioEstadoParams = z.infer<
  typeof inventarioEstadoParamsSchema
>;

// RF-04 (Fase 5, WEB) — GET /inventarios (listado).
export const inventariosQuerySchema = z.object({
  organizacionId: z.string().min(1),
});
export type InventariosQuery = z.infer<typeof inventariosQuerySchema>;

// GET /inventarios/:id (detalle) — mismo shape que inventarioEstadoParamsSchema, nombre de
// campo distinto (`id`, no `inventarioId`) porque la ruta usa `:id` para no chocar con
// `inventarios/:inventarioId/estado`.
export const inventarioDetalleParamsSchema = z.object({
  id: z.string().min(1),
});
export type InventarioDetalleParams = z.infer<
  typeof inventarioDetalleParamsSchema
>;
