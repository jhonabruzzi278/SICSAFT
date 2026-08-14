import { z } from 'zod';

// DOC-012 §5 — lo que WEB manda a CIS. Mas chico que PostActivoRequest (core-client.types.ts):
// `operadorId`/`rolesPorOrganizacion` los resuelve CIS a partir del access token ya validado
// (ZitadelAuthGuard), nunca se confian desde el body de un cliente de navegador.
export const altaActivoSchema = z.object({
  organizacionId: z.string().min(1),
  codigoPatrimonial: z.string().min(1),
  codigoQr: z.string().min(1),
  catalogoId: z.string().min(1),
  serie: z.string().min(1).optional(),
  responsableId: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  ubicacionId: z.string().min(1).optional(),
  valorPatrimonial: z.number().nonnegative().optional(),
});
export type AltaActivoBody = z.infer<typeof altaActivoSchema>;

// DOC-012 §7 — lo que WEB manda a CIS para POST /contratos / PATCH /contratos/:id. Mismo criterio
// que altaActivoSchema: operadorId/rolesPorOrganizacion los resuelve CIS, nunca el body.
export const altaContratoSchema = z.object({
  organizacionId: z.string().min(1),
  sedeIds: z.array(z.string().min(1)).min(1),
  vigenciaDesde: z.string().min(1),
  vigenciaHasta: z.string().min(1).nullable().optional(),
  modulosContratados: z.array(z.literal('inventario-qr')).min(1),
});
export type AltaContratoBody = z.infer<typeof altaContratoSchema>;

export const actualizarContratoSchema = z.object({
  organizacionId: z.string().min(1),
  estado: z.enum(['vigente', 'suspendido', 'vencido', 'cancelado']),
});
export type ActualizarContratoBody = z.infer<typeof actualizarContratoSchema>;
