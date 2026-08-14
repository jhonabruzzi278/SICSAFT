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

// RF-05 (cierra el gap "ABM completo") — PATCH /areas/:id, todos los campos opcionales pero
// exige al menos uno via refine (un PATCH sin campos a cambiar no tiene sentido).
export const actualizarAreaSchema = escrituraOficialSchema
  .extend({
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

export const altaUbicacionSchema = escrituraOficialSchema.extend({
  sedeId: z.string().min(1),
  edificio: z.string().min(1).optional(),
  piso: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  oficina: z.string().min(1).optional(),
  dependencia: z.string().min(1).optional(),
});
export type AltaUbicacionBody = z.infer<typeof altaUbicacionSchema>;

// RF-05 (cierra el gap "ABM completo") — PATCH /ubicaciones/:id. Sin `sedeId` (ver
// ubicacion.types.ts, ActualizarUbicacionInput) — mover de sede es un traslado, fuera de alcance.
export const actualizarUbicacionSchema = escrituraOficialSchema
  .extend({
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

// RNF-01 (cierra el gap) — limit/offset con los mismos defaults que catalogoQuerySchema (DOC-006
// §2): 20 por pagina, tope 100.
const paginacionSchema = {
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
};

export const areasQuerySchema = z.object({
  organizacionId: z.string().min(1),
  ...paginacionSchema,
});
export type AreasQuery = z.infer<typeof areasQuerySchema>;

export const ubicacionesQuerySchema = z.object({
  sedeId: z.string().min(1),
  ...paginacionSchema,
});
export type UbicacionesQuery = z.infer<typeof ubicacionesQuerySchema>;

export const responsablesQuerySchema = z.object({
  areaId: z.string().min(1),
  ...paginacionSchema,
});
export type ResponsablesQuery = z.infer<typeof responsablesQuerySchema>;
