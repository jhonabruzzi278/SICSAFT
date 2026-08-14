import { z } from 'zod';
import { escrituraOficialSchema } from './activo.schemas';

// DOC-012 §6 — misma forma de fila que altaActivoSchema, sin organizacionId/campos de escritura
// oficial repetidos por fila (esos son del request completo, ver escrituraOficialSchema).
const filaImportacionSchema = z.object({
  codigoPatrimonial: z.string().min(1),
  codigoQr: z.string().min(1),
  catalogoId: z.string().min(1),
  serie: z.string().min(1).optional(),
  responsableId: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
  valorPatrimonial: z.number().nonnegative().optional(),
});

export const importacionContableSchema = escrituraOficialSchema.extend({
  filas: z.array(filaImportacionSchema).min(1),
});
export type ImportacionContableBody = z.infer<typeof importacionContableSchema>;
