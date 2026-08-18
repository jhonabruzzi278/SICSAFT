import { z } from 'zod';

// DOC-012 3.3 — CIS reenvia operadorId + rolesPorOrganizacion en el body de cada llamada de
// escritura oficial (mismo canal service-to-service ya protegido por ServiceTokenGuard).
// `organizacionId` es obligatorio en TODOS los endpoints de escritura oficial, no solo en alta:
// es contra qué organizacion se verifica el rol (verificarRolAdministradorPatrimonial exige
// rolesPorOrganizacion[organizacionId], nunca "¿tiene el rol en algun lado?") y el repository
// vuelve a cruzarlo contra la organizacion real del activo objetivo antes de escribir — sin esto,
// un administrador-patrimonial de la Organizacion A podia escribir sobre activos de la
// Organizacion B (hallazgo real de revision de seguridad, corregido en este mismo incremento).
// `rolesPorOrganizacion`/`organizacionId` se validan acá solo en forma — el contenido lo revisa
// OrquestadorService (verificarRolAdministradorPatrimonial) y ActivoRepository, no este schema.
export const escrituraOficialSchema = z.object({
  correlationId: z.string().min(1),
  operadorId: z.string().min(1),
  organizacionId: z.string().min(1),
  rolesPorOrganizacion: z.record(z.string(), z.array(z.string())),
});
export type EscrituraOficialBody = z.infer<typeof escrituraOficialSchema>;

// DOC-012 5 — POST /activos (alta). CORE decide `estado` ('activo') y `fechaAlta` (hoy) — nunca
// se confian esos dos campos desde el cliente.
export const altaActivoSchema = escrituraOficialSchema.extend({
  codigoPatrimonial: z.string().min(1),
  codigoQr: z.string().min(1),
  catalogoId: z.string().min(1),
  serie: z.string().min(1).optional(),
  responsableId: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
  valorPatrimonial: z.number().nonnegative().optional(),
});
export type AltaActivoBody = z.infer<typeof altaActivoSchema>;

// DOC-012 5 — PATCH /activos/:id/responsable.
export const cambioResponsableSchema = escrituraOficialSchema.extend({
  responsableId: z.string().min(1),
});
export type CambioResponsableBody = z.infer<typeof cambioResponsableSchema>;
