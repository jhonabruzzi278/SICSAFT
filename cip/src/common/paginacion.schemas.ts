import { z } from 'zod';

// Mismo fragmento que core/src/common/paginacion.schemas.ts (RNF-02, DOC-018 §6).
export const paginacionSchema = {
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
};
