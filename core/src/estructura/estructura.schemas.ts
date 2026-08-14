import { z } from 'zod';
import { escrituraOficialSchema } from '../patrimonial/activo.schemas';

// RF-05 (Fase 5) — reusa el mismo envoltorio de escritura oficial que Activo/Contrato
// (escrituraOficialSchema es generico, no especifico de Activo pese a vivir en
// patrimonial/activo.schemas.ts).
export const altaAreaSchema = escrituraOficialSchema.extend({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  dependencia: z.string().min(1).optional(),
  centroCosto: z.string().min(1).optional(),
});
export type AltaAreaBody = z.infer<typeof altaAreaSchema>;

export const altaUbicacionSchema = escrituraOficialSchema.extend({
  sedeId: z.string().min(1),
  edificio: z.string().min(1).optional(),
  piso: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  oficina: z.string().min(1).optional(),
  dependencia: z.string().min(1).optional(),
});
export type AltaUbicacionBody = z.infer<typeof altaUbicacionSchema>;

export const altaResponsableSchema = escrituraOficialSchema.extend({
  identificacion: z.string().min(1),
  nombre: z.string().min(1),
  cargo: z.string().min(1).optional(),
  areaId: z.string().min(1),
  correo: z.string().email().optional(),
  telefono: z.string().min(1).optional(),
});
export type AltaResponsableBody = z.infer<typeof altaResponsableSchema>;

// RF-05 — la "baja" de un Responsable (Tomo III §4.10, el historial nunca se borra: nunca un
// DELETE, mismo criterio que Activo/Contrato).
export const actualizarEstadoResponsableSchema = escrituraOficialSchema.extend({
  estado: z.enum(['activo', 'inactivo']),
});
export type ActualizarEstadoResponsableBody = z.infer<
  typeof actualizarEstadoResponsableSchema
>;

export const areasQuerySchema = z.object({ organizacionId: z.string().min(1) });
export type AreasQuery = z.infer<typeof areasQuerySchema>;

export const ubicacionesQuerySchema = z.object({ sedeId: z.string().min(1) });
export type UbicacionesQuery = z.infer<typeof ubicacionesQuerySchema>;

export const responsablesQuerySchema = z.object({ areaId: z.string().min(1) });
export type ResponsablesQuery = z.infer<typeof responsablesQuerySchema>;
