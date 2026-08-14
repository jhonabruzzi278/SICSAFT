import { z } from 'zod';
import { escrituraOficialSchema } from '../patrimonial/activo.schemas';

// DOC-012 §7 — POST /contratos (alta). CORE decide `estado` ('vigente') y `id` — nunca se
// confian esos dos campos desde el cliente (mismo criterio que altaActivoSchema).
export const altaContratoSchema = escrituraOficialSchema.extend({
  sedeIds: z.array(z.string().min(1)).min(1),
  vigenciaDesde: z.string().min(1),
  vigenciaHasta: z.string().min(1).nullable().optional(),
  modulosContratados: z.array(z.literal('inventario-qr')).min(1),
});
export type AltaContratoBody = z.infer<typeof altaContratoSchema>;

// DOC-012 §7 — PATCH /contratos/:id. Solo transiciones validas de la maquina de estados de
// DOC-004 §3 (vigente ⇄ suspendido, vigente → vencido|cancelado) — la validacion de CUALES
// transiciones son validas vive en escritura-contrato.service.ts, no acá (este schema solo
// valida la forma, igual que escrituraOficialSchema).
export const actualizarContratoSchema = escrituraOficialSchema.extend({
  estado: z.enum(['vigente', 'suspendido', 'vencido', 'cancelado']),
});
export type ActualizarContratoBody = z.infer<typeof actualizarContratoSchema>;
