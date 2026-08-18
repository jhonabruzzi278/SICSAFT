import { z } from 'zod';

// DOC-019 §3.1/§4 — organizacionId es un query param libre, sin cruzarlo contra
// rolesPorOrganizacion del operador: mismo criterio ya aceptado por catalogoQuerySchema/
// inventariosQuerySchema (qr-connector.schemas.ts) para lectura abierta — el cliente ya obtuvo la
// lista de organizaciones con contrato vigente vía POST /auth/session (GET /entitlements) y se
// confía en que pide una de esas, igual que Activos/Inventarios hacen hoy. Mismos defaults de
// limit/offset que administrador.schemas.ts (RNF-01).
const paginacionSchema = {
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
};

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
