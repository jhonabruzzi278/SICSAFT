import { z } from 'zod';
import { paginacionSchema } from '../common/paginacion.schemas';

// RF-06 — filtros opcionales. RNF-01 (cierra el gap) — limit/offset con los mismos defaults que
// catalogoQuerySchema (DOC-006 2): 20 por pagina, tope 100. DOC-024 3 — `categoria`/
// `organizacionId` filtran por igualdad exacta (no ILIKE, a diferencia de usuario/operacion), ver
// AuditoriaRepository.listar.
export const auditoriaQuerySchema = z.object({
  usuario: z.string().min(1).optional(),
  operacion: z.string().min(1).optional(),
  fechaDesde: z.string().min(1).optional(),
  fechaHasta: z.string().min(1).optional(),
  categoria: z.enum(['patrimonial', 'identidad']).optional(),
  organizacionId: z.string().min(1).optional(),
  // DOC-029 RF-E — filtro parcial por área operativa (ILIKE, ver AuditoriaRepository.listar).
  area: z.string().min(1).optional(),
  ...paginacionSchema,
});
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;

// DOC-024 3 — POST /auditoria. Exclusivo de CIS, para reportar el resultado de una operacion de
// identidad en Zitadel que nunca pasa por el Orquestador (asignar/quitar rol, crear organizacion
// en Zitadel). Sin `categoria`: la fuerza el controller a 'identidad' server-side — ningun
// llamador puede reportarse a si mismo como 'patrimonial', esa categoria es exclusiva de
// OrquestadorService.
export const registrarAuditoriaSchema = z.object({
  usuario: z.string().min(1),
  operacion: z.string().min(1),
  resultado: z.string().min(1),
  observaciones: z.string().min(1).optional(),
  organizacionId: z.string().min(1).optional(),
});
export type RegistrarAuditoriaBody = z.infer<typeof registrarAuditoriaSchema>;
