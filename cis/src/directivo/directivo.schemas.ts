import { z } from 'zod';

// DOC-022 3 — el rol asignable está fijo a `administrador-patrimonial`: el Directivo solo puede
// designar quién es el Profesional de AFT de su organización, nunca asignarse a sí mismo otro
// Directivo. Por eso este schema no tiene un campo `rol` — no hay nada que elegir.
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
