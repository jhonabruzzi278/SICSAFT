import { z } from 'zod';

// RF-06 — filtros opcionales. RNF-01 (cierra el gap) — limit/offset con los mismos defaults que
// catalogoQuerySchema (DOC-006 §2): 20 por pagina, tope 100.
export const auditoriaQuerySchema = z.object({
  usuario: z.string().min(1).optional(),
  operacion: z.string().min(1).optional(),
  fechaDesde: z.string().min(1).optional(),
  fechaHasta: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;
