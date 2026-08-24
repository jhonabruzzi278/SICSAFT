import { z } from 'zod';
import { escrituraOficialSchema } from '../patrimonial/activo.schemas';

// Gap 2 (flujo real Admin->Directivo->Profesional AFT) — POST /sedes. A diferencia de
// altaOrganizacionSchema, sí exige `organizacionId` (una Sede siempre pertenece a una
// organización puntual, y el rol se verifica contra ESA organización — mismo criterio que
// Contrato, no el de Organización) y no recibe `id`: lo genera CORE (ver sede.repository.ts).
export const altaSedeSchema = escrituraOficialSchema.extend({
  nombre: z.string().min(1),
});
export type AltaSedeBody = z.infer<typeof altaSedeSchema>;

// DOC-024 1 — GET /sedes?organizacionId=. Lectura abierta (mismo criterio que
// OrganizacionController/ContratoController) pero exige `organizacionId`: a diferencia de
// Organizacion, una Sede no tiene sentido listada "de todas partes a la vez" — siempre se
// consulta para una organizacion puntual (ej. el picker de sedes al crear un Contrato).
export const sedesQuerySchema = z.object({
  organizacionId: z.string().min(1),
});
export type SedesQuery = z.infer<typeof sedesQuerySchema>;

// DOC-024 1 — PATCH /sedes/:id/estado. Bidireccional, sin cascada a Contrato (DOC-024 1).
export const actualizarEstadoSedeSchema = escrituraOficialSchema.extend({
  estado: z.enum(['activo', 'inactivo']),
});
export type ActualizarEstadoSedeBody = z.infer<
  typeof actualizarEstadoSedeSchema
>;
