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

// RF-05 (Fase 5) — lo que WEB manda a CIS para POST /admin/areas/ubicaciones/responsables. Mismo
// criterio que altaActivoSchema: operadorId/rolesPorOrganizacion los resuelve CIS, nunca el body.
export const altaAreaSchema = z.object({
  organizacionId: z.string().min(1),
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  dependencia: z.string().min(1).optional(),
  centroCosto: z.string().min(1).optional(),
});
export type AltaAreaBody = z.infer<typeof altaAreaSchema>;

export const areasQuerySchema = z.object({ organizacionId: z.string().min(1) });
export type AreasQuery = z.infer<typeof areasQuerySchema>;

export const altaUbicacionSchema = z.object({
  organizacionId: z.string().min(1),
  sedeId: z.string().min(1),
  edificio: z.string().min(1).optional(),
  piso: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  oficina: z.string().min(1).optional(),
  dependencia: z.string().min(1).optional(),
});
export type AltaUbicacionBody = z.infer<typeof altaUbicacionSchema>;

export const ubicacionesQuerySchema = z.object({ sedeId: z.string().min(1) });
export type UbicacionesQuery = z.infer<typeof ubicacionesQuerySchema>;

export const altaResponsableSchema = z.object({
  organizacionId: z.string().min(1),
  identificacion: z.string().min(1),
  nombre: z.string().min(1),
  cargo: z.string().min(1).optional(),
  areaId: z.string().min(1),
  correo: z.string().email().optional(),
  telefono: z.string().min(1).optional(),
});
export type AltaResponsableBody = z.infer<typeof altaResponsableSchema>;

export const responsablesQuerySchema = z.object({ areaId: z.string().min(1) });
export type ResponsablesQuery = z.infer<typeof responsablesQuerySchema>;

export const actualizarEstadoResponsableSchema = z.object({
  organizacionId: z.string().min(1),
  estado: z.enum(['activo', 'inactivo']),
});
export type ActualizarEstadoResponsableBody = z.infer<
  typeof actualizarEstadoResponsableSchema
>;

// RF-06 — filtros de GET /admin/auditoria, todos opcionales (cierra el gap: el requisito pedia
// "filtrable por usuario/fecha/operacion").
export const auditoriaQuerySchema = z.object({
  usuario: z.string().min(1).optional(),
  operacion: z.string().min(1).optional(),
  fechaDesde: z.string().min(1).optional(),
  fechaHasta: z.string().min(1).optional(),
});
export type AuditoriaQuery = z.infer<typeof auditoriaQuerySchema>;
