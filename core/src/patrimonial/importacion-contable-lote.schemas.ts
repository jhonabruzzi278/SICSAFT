import { z } from 'zod';
import { escrituraOficialSchema } from './activo.schemas';

// DOC-029 RF-B — el ETL manda las filas ya canónicas (nombres del Excel resueltos a ids) más el
// texto crudo original por fila. `crudo` es informativo para el revisor, no se valida su forma.
const filaLoteSchema = z.object({
  linea: z.number().int().positive(),
  codigoPatrimonial: z.string().min(1),
  codigoQr: z.string().min(1),
  catalogoId: z.string().min(1),
  serie: z.string().min(1).optional(),
  responsableId: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
  valorPatrimonial: z.number().nonnegative().optional(),
  crudo: z.record(z.string(), z.string()).default({}),
});

export const crearLoteSchema = escrituraOficialSchema.extend({
  origen: z.enum(['carpeta', 'manual']),
  archivoNombre: z.string().min(1).optional(),
  filas: z.array(filaLoteSchema).min(1),
});
export type CrearLoteBody = z.infer<typeof crearLoteSchema>;

// Aprobar solo necesita la identidad oficial (contra qué organización se verifica el rol).
export const aprobarLoteSchema = escrituraOficialSchema;
export type AprobarLoteBody = z.infer<typeof aprobarLoteSchema>;

export const rechazarLoteSchema = escrituraOficialSchema.extend({
  motivo: z.string().min(1).optional(),
});
export type RechazarLoteBody = z.infer<typeof rechazarLoteSchema>;
