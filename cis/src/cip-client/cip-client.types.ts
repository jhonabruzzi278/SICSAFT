import { z } from 'zod';

// DOC-019 3.1 — copia local de las formas de respuesta de cip/src/dashboard/dashboard.types.ts.
// Sin paquete compartido entre CIS y CIP todavía (mismo caso ya aceptado para CIS/CORE en
// core-client.types.ts).

const syncInfoSchema = z.object({
  actualizadoEn: z.string().nullable(),
  alDia: z.boolean(),
});

export interface Paginacion {
  limit?: number;
  offset?: number;
}

export const coberturaResponseSchema = syncInfoSchema.extend({
  activosRegistrados: z.number(),
  activosEscaneados: z.number(),
  porcentajeCobertura: z.number(),
});
export type CoberturaResult = z.infer<typeof coberturaResponseSchema>;

const controlAreaSchema = z.object({
  areaId: z.string(),
  controladaEnPeriodo: z.boolean(),
  ultimaSesionEn: z.string().nullable(),
});
export const areasResponseSchema = syncInfoSchema.extend({
  areas: z.array(controlAreaSchema),
});
export type AreasResult = z.infer<typeof areasResponseSchema>;

const veredictoSesionSchema = z.object({
  sesionId: z.string(),
  areaId: z.string(),
  veredicto: z.string(),
  fechaCierre: z.string(),
});
export const sesionesResponseSchema = syncInfoSchema.extend({
  items: z.array(veredictoSesionSchema),
  total: z.number(),
});
export type SesionesResult = z.infer<typeof sesionesResponseSchema>;

const fueraDeAreaSchema = z.object({
  codigoQr: z.string(),
  areaRealId: z.string(),
  areaEsperadaId: z.string(),
  detectadoEn: z.string(),
});
export const fueraDeAreaResponseSchema = syncInfoSchema.extend({
  items: z.array(fueraDeAreaSchema),
  total: z.number(),
});
export type FueraDeAreaResult = z.infer<typeof fueraDeAreaResponseSchema>;

const noLocalizadoSchema = z.object({
  codigoQr: z.string(),
  desdeEn: z.string(),
});
export const noLocalizadosResponseSchema = syncInfoSchema.extend({
  items: z.array(noLocalizadoSchema),
  total: z.number(),
});
export type NoLocalizadosResult = z.infer<typeof noLocalizadosResponseSchema>;

const incidenciaSchema = z.object({
  sesionId: z.string(),
  codigoQr: z.string(),
  observaciones: z.string(),
  fecha: z.string(),
});
export const incidenciasResponseSchema = syncInfoSchema.extend({
  items: z.array(incidenciaSchema),
  total: z.number(),
});
export type IncidenciasResult = z.infer<typeof incidenciasResponseSchema>;

const estadoResumenSchema = z.object({
  estado: z.string(),
  cantidad: z.number(),
});
export const estadoActivosResponseSchema = syncInfoSchema.extend({
  estados: z.array(estadoResumenSchema),
});
export type EstadoActivosResult = z.infer<typeof estadoActivosResponseSchema>;

const categoriaResumenSchema = z.object({
  areaId: z.string(),
  familia: z.string(),
  cantidad: z.number(),
});
export const categoriasResponseSchema = syncInfoSchema.extend({
  categorias: z.array(categoriaResumenSchema),
});
export type CategoriasResult = z.infer<typeof categoriasResponseSchema>;
