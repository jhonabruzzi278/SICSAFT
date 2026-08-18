import { z } from 'zod';
import { escrituraOficialSchema } from './activo.schemas';

// DOC-021 4 — POST /catalogo-tipos. Mismo verificador default (solo administrador-patrimonial,
// es dato patrimonial) — reusa escrituraOficialSchema, no un schema propio de autorizacion.
// `organizacionId` viaja solo para probar el rol (catalogo_activos es compartido entre
// organizaciones, la fila creada no queda asociada a ninguna) — se verifica que el operador
// tenga administrador-patrimonial EN esa organizacion concreta, igual que cualquier otra
// escritura oficial.
export const altaCatalogoTipoSchema = escrituraOficialSchema.extend({
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
