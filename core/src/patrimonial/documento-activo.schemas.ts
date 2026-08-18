import { z } from 'zod';
import { escrituraOficialSchema } from './activo.schemas';

// DOC-021 3 — POST /activos/:id/documentos.
export const altaDocumentoActivoSchema = escrituraOficialSchema.extend({
  tipo: z.enum(['documento', 'fotografia']),
  url: z.string().url(),
  descripcion: z.string().min(1).optional(),
});
export type AltaDocumentoActivoBody = z.infer<typeof altaDocumentoActivoSchema>;

// DOC-021 3 — DELETE /activos/:id/documentos/:documentoId. Mismo shape que
// escrituraOficialSchema (solo necesita organizacionId para el chequeo de rol) — alias con
// nombre propio para legibilidad en el controller/orquestador.
export const eliminarDocumentoActivoSchema = escrituraOficialSchema;
export type EliminarDocumentoActivoBody = z.infer<
  typeof eliminarDocumentoActivoSchema
>;

// DOC-021 3 — GET /activos/:id/documentos?organizacionId=... — lectura abierta (mismo criterio
// que GET /catalogo-tipos), sin verificarRolAdministradorPatrimonial: solo necesita
// organizacionId para el cruce de defensa en profundidad del repository.
export const documentosActivoQuerySchema = z.object({
  organizacionId: z.string().min(1),
});
export type DocumentosActivoQuery = z.infer<typeof documentosActivoQuerySchema>;
