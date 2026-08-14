import { z } from 'zod';
import { paginacionSchema } from '../common/paginacion.schemas';

// DOC-006 §2 — mismo shape que CatalogoQuery de CIS (cis/src/qr-connector/qr-connector.schemas.ts),
// mas paginacion (RNF-01, sin precedente de cursor en el resto del proyecto — LIMIT/OFFSET simple).
export const catalogoQuerySchema = z.object({
  organizacionId: z.string().min(1),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
  ...paginacionSchema,
});
export type CatalogoQuery = z.infer<typeof catalogoQuerySchema>;
