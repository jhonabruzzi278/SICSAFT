import { z } from 'zod';

// Contrato propuesto en base-patrimonial/DOC-004-modelo-contrato.md 6 — todavia no formalizado
// como DOC-006 (API CIS<->CORE).
export const entitlementsQuerySchema = z.object({
  operadorId: z.string().min(1),
});
export type EntitlementsQuery = z.infer<typeof entitlementsQuerySchema>;
