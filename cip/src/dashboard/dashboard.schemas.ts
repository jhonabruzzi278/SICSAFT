import { z } from 'zod';
import { paginacionSchema } from '../common/paginacion.schemas';

// DOC-018 §6 — organizacionId obligatorio en todos, limit/offset solo en los listados
// potencialmente grandes (sesiones, fuera de área, no localizados, incidencias) — áreas, estado
// de activos y categorías son agregados acotados por diseño, sin paginar.

export const coberturaQuerySchema = z.object({
  organizacionId: z.string().min(1),
});
export type CoberturaQuery = z.infer<typeof coberturaQuerySchema>;

export const areasQuerySchema = coberturaQuerySchema;
export type AreasQuery = z.infer<typeof areasQuerySchema>;

export const estadoActivosQuerySchema = coberturaQuerySchema;
export type EstadoActivosQuery = z.infer<typeof estadoActivosQuerySchema>;

export const categoriasQuerySchema = z.object({
  organizacionId: z.string().min(1),
  areaId: z.string().min(1).optional(),
});
export type CategoriasQuery = z.infer<typeof categoriasQuerySchema>;

export const sesionesQuerySchema = z.object({
  organizacionId: z.string().min(1),
  areaId: z.string().min(1).optional(),
  ...paginacionSchema,
});
export type SesionesQuery = z.infer<typeof sesionesQuerySchema>;

export const fueraDeAreaQuerySchema = sesionesQuerySchema;
export type FueraDeAreaQuery = z.infer<typeof fueraDeAreaQuerySchema>;

export const noLocalizadosQuerySchema = z.object({
  organizacionId: z.string().min(1),
  ...paginacionSchema,
});
export type NoLocalizadosQuery = z.infer<typeof noLocalizadosQuerySchema>;

export const incidenciasQuerySchema = z.object({
  organizacionId: z.string().min(1),
  codigoQr: z.string().min(1).optional(),
  ...paginacionSchema,
});
export type IncidenciasQuery = z.infer<typeof incidenciasQuerySchema>;
