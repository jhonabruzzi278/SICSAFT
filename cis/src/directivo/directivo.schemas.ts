import { z } from 'zod';

// DOC-022 3 — a diferencia de asignarUsuarioOrganizacionSchema (administrador/administrador.schemas.ts),
// que acepta los 3 roles de Proyecto porque Administrador del Sistema administra toda la
// plataforma, acá el rol asignable está fijo a `administrador-patrimonial`: el Directivo solo
// puede designar quién es el Profesional de AFT de su organización, nunca asignarse a sí mismo
// otro Directivo ni un Administrador del Sistema.
export const asignarProfesionalAftSchema = z.object({
  email: z.string().email(),
});
export type AsignarProfesionalAftBody = z.infer<
  typeof asignarProfesionalAftSchema
>;
