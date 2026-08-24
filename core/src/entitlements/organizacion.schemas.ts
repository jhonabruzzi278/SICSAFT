import { z } from 'zod';

// DOC-021 4 / DOC-022 3 — POST /organizaciones. `id` = el org_id real de Zitadel (la organizacion
// ya existe en Zitadel — Zitadel es la fuente de verdad de identidad, DOC-004 2 "Organización";
// esto solo crea la fila cache en `organizaciones` para que Contrato pueda referenciarla).
// Sin `organizacionId` a proposito (a diferencia de escrituraOficialSchema, que lo exige para
// Activo/Contrato/etc.): el rol administrador-sistema se verifica en CUALQUIER organizacion
// (verificarRolEnCualquierOrganizacion, DOC-022 3), no contra una organizacionId puntual — un
// Administrador del Sistema no necesariamente pertenece a ninguna organizacion de negocio
// todavia, y exigirle una era el bug real que motivo separar `web_admin/` (ver DOC-022).
export const altaOrganizacionSchema = z.object({
  correlationId: z.string().min(1),
  operadorId: z.string().min(1),
  rolesPorOrganizacion: z.record(z.string(), z.array(z.string())),
  id: z.string().min(1),
  nombre: z.string().min(1),
});
export type AltaOrganizacionBody = z.infer<typeof altaOrganizacionSchema>;

// DOC-024 1 — PATCH /organizaciones/:id (editar nombre). Mismo criterio sin `organizacionId` que
// altaOrganizacionSchema: administrador-sistema se verifica en CUALQUIER organizacion, el `:id`
// de la ruta es el objetivo, no la organizacion contra la que se autoriza.
export const actualizarOrganizacionSchema = z.object({
  correlationId: z.string().min(1),
  operadorId: z.string().min(1),
  rolesPorOrganizacion: z.record(z.string(), z.array(z.string())),
  nombre: z.string().min(1),
});
export type ActualizarOrganizacionBody = z.infer<
  typeof actualizarOrganizacionSchema
>;

// DOC-024 1 — PATCH /organizaciones/:id/estado. Bidireccional (activo ⇄ inactivo, nunca DELETE —
// Tomo III 4.10), sin cascada a Contrato (ver DOC-024 1).
export const actualizarEstadoOrganizacionSchema = z.object({
  correlationId: z.string().min(1),
  operadorId: z.string().min(1),
  rolesPorOrganizacion: z.record(z.string(), z.array(z.string())),
  estado: z.enum(['activo', 'inactivo']),
});
export type ActualizarEstadoOrganizacionBody = z.infer<
  typeof actualizarEstadoOrganizacionSchema
>;
