import { z } from 'zod';
import { escrituraOficialSchema } from '../patrimonial/activo.schemas';
import { paginacionSchema } from '../common/paginacion.schemas';

// DOC-012 7 — POST /contratos (alta). CORE decide `estado` ('vigente') y `id` — nunca se
// confian esos dos campos desde el cliente (mismo criterio que altaActivoSchema).
export const altaContratoSchema = escrituraOficialSchema.extend({
  sedeIds: z.array(z.string().min(1)).min(1),
  vigenciaDesde: z.string().min(1),
  vigenciaHasta: z.string().min(1).nullable().optional(),
  modulosContratados: z.array(z.literal('inventario-qr')).min(1),
});
export type AltaContratoBody = z.infer<typeof altaContratoSchema>;

// DOC-012 7 — PATCH /contratos/:id. Solo transiciones validas de la maquina de estados de
// DOC-004 3 (vigente ⇄ suspendido, vigente → vencido|cancelado) — la validacion de CUALES
// transiciones son validas vive en escritura-contrato.service.ts, no acá (este schema solo
// valida la forma, igual que escrituraOficialSchema).
export const actualizarContratoSchema = escrituraOficialSchema.extend({
  estado: z.enum(['vigente', 'suspendido', 'vencido', 'cancelado']),
});
export type ActualizarContratoBody = z.infer<typeof actualizarContratoSchema>;

// RNF-01 (cierra el gap) — mismos defaults que catalogoQuerySchema (DOC-006 2): 20 por pagina,
// tope 100.
export const contratosQuerySchema = z.object({
  ...paginacionSchema,
});
export type ContratosQuery = z.infer<typeof contratosQuerySchema>;

// DOC-024 2 — PATCH /contratos/:id/condiciones. Endpoint separado de actualizarContratoSchema
// (que solo cambia `estado`) — ver DOC-024 2 para por que no se mezclan. `vigenciaDesde`
// deliberadamente no editable (mover la fecha de inicio hacia atras no es un caso real). Los 3
// campos son opcionales individualmente pero se exige al menos uno (`.refine`), para que un PATCH
// vacio sea un 400 explicito en vez de un no-op silencioso.
export const actualizarCondicionesContratoSchema = escrituraOficialSchema
  .extend({
    sedeIds: z.array(z.string().min(1)).min(1).optional(),
    vigenciaHasta: z.string().min(1).nullable().optional(),
    modulosContratados: z.array(z.literal('inventario-qr')).min(1).optional(),
  })
  .refine(
    (body) =>
      body.sedeIds !== undefined ||
      body.vigenciaHasta !== undefined ||
      body.modulosContratados !== undefined,
    { message: 'Debe incluir al menos un campo a actualizar' },
  );
export type ActualizarCondicionesContratoBody = z.infer<
  typeof actualizarCondicionesContratoSchema
>;
