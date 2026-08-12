import { z } from 'zod';

// Contrato: app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md
// Implementacion MOCK — ver qr-connector.service.ts. Las 4 preguntas abiertas a SICSAFT CORE
// (DOC-002 §3/§6, HANDOFF-APP-QR-SICSAFT.md §6) siguen sin respuesta; este contrato es el
// punto de partida de la negociacion, no una API ya acordada con CORE.

export const authSessionRequestSchema = z.object({
  operadorId: z.string().min(1),
  credencial: z.string().min(1),
  deviceId: z.string().min(1),
});
export type AuthSessionRequest = z.infer<typeof authSessionRequestSchema>;

export const catalogoQuerySchema = z.object({
  organizacionId: z.string().min(1),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
});
export type CatalogoQuery = z.infer<typeof catalogoQuerySchema>;

// Las 8 categorias de resultado de escaneo de DOC-001 §3 / scan-resolve.ts de APP QR.
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

const escaneoSchema = z.object({
  codigoQr: z.string().min(1),
  resultado: scanResultadoSchema,
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
export type InventarioRequest = z.infer<typeof inventarioRequestSchema>;
