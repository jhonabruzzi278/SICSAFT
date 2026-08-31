import { z } from 'zod';
import { escrituraOficialSchema } from './activo.schemas';

// DOC-029 RF-B — el ETL manda por fila: los ids canónicos que ya pudo resolver y/o los nombres
// tal cual del Excel (dirección/área/responsable/categoría), más el texto crudo original. `aprobar`
// resuelve-o-crea a partir de los nombres lo que falte. `crudo` es informativo, no se valida.
const filaLoteSchema = z
  .object({
    linea: z.number().int().positive(),
    codigoPatrimonial: z.string().min(1),
    codigoQr: z.string().min(1),
    catalogoId: z.string().min(1).optional(),
    serie: z.string().min(1).optional(),
    responsableId: z.string().min(1).optional(),
    areaId: z.string().min(1).optional(),
    ubicacionId: z.string().min(1).optional(),
    valorPatrimonial: z.number().nonnegative().optional(),
    direccionNombre: z.string().min(1).optional(),
    areaNombre: z.string().min(1).optional(),
    responsableNombre: z.string().min(1).optional(),
    categoriaNombre: z.string().min(1).optional(),
    nombreAft: z.string().min(1).optional(),
    crudo: z.record(z.string(), z.string()).default({}),
  })
  // Un activo necesita un catálogo sí o sí (activos.catalogo_id NOT NULL) — o el id ya resuelto,
  // o el nombre de categoría para resolverlo al aprobar.
  .refine((f) => Boolean(f.catalogoId ?? f.categoriaNombre), {
    message: 'cada fila necesita catalogoId o categoriaNombre',
    path: ['catalogoId'],
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
