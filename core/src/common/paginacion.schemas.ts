import { z } from 'zod';

// RNF-01 — fragmento compartido por todos los listados paginados (limit/offset, default 20 por
// pagina, tope 100). Antes duplicado en cada *.schemas.ts (catalogo, auditoria, contrato,
// estructura) — SonarCloud lo marcaba como duplicacion real.
export const paginacionSchema = {
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
};
