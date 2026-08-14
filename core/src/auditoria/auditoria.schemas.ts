import { z } from 'zod';

// RF-06 — todos opcionales: sin filtros, GET /auditoria devuelve las 200 mas recientes (ya asi
// desde el primer incremento).
export const auditoriaQuerySchema = z.object({
  usuario: z.string().min(1).optional(),
  operacion: z.string().min(1).optional(),
  fechaDesde: z.string().min(1).optional(),
  fechaHasta: z.string().min(1).optional(),
});
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;
