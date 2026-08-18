import { z } from 'zod';
import { escrituraOficialSchema } from '../patrimonial/activo.schemas';

// DOC-021 4 — POST /organizaciones. `id` = el org_id real de Zitadel (la organizacion ya existe
// en Zitadel — Zitadel es la fuente de verdad de identidad, DOC-004 2 "Organización"; esto solo
// crea la fila cache en `organizaciones` para que Contrato pueda referenciarla). `organizacionId`
// (heredado de escrituraOficialSchema) es la organizacion donde se verifica que el operador tenga
// el rol administrador-sistema — no tiene por que coincidir con el `id` de la organizacion nueva
// que se esta creando (un Administrador del Sistema no necesariamente pertenece a ninguna
// organizacion de negocio todavia).
export const altaOrganizacionSchema = escrituraOficialSchema.extend({
  id: z.string().min(1),
  nombre: z.string().min(1),
});
export type AltaOrganizacionBody = z.infer<typeof altaOrganizacionSchema>;
