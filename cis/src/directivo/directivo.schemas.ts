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

// Gap 3 (flujo real Admin->Directivo->Profesional AFT) — antes este endpoint devolvía void y
// exigía que el email ya existiera en Zitadel. `passwordInicial` solo viene no-null cuando
// `creado` es true (usuario nuevo) — el Directivo la comparte con el profesional fuera de banda,
// nunca se persiste en ningún lado del cliente.
export interface AsignarProfesionalAftResult {
  creado: boolean;
  passwordInicial: string | null;
}
