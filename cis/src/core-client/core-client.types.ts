import { z } from 'zod';

// Contrato de GET /entitlements de CORE — ver base-patrimonial/DOC-004-modelo-contrato.md §6.
// Se valida la respuesta acá porque CORE es un limite de confianza (proceso/red distintos, ver
// coding-style: "validar en los limites del sistema"), no porque se desconfie del codigo propio.
const sedeSchema = z.object({
  id: z.string(),
  nombre: z.string(),
});

const organizacionSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  sedes: z.array(sedeSchema),
});

export const entitlementsResponseSchema = z.object({
  organizaciones: z.array(organizacionSchema),
});

export type EntitlementsResult = z.infer<typeof entitlementsResponseSchema>;

// Contrato de GET /catalogo de CORE — ver core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md
// §2. CORE pagina (`total`), pero el contrato ya construido con APP QR (DOC-002) no expone
// paginacion todavia — CoreClientService devuelve solo `activos`, sin cambiar CatalogoResponse.
const activoCatalogoSchema = z.object({
  codigoQr: z.string(),
  nombre: z.string(),
  organizacionId: z.string(),
  areaId: z.string(),
  ubicacionId: z.string(),
  estado: z.string(),
});

export const catalogoResponseSchema = z.object({
  activos: z.array(activoCatalogoSchema),
  total: z.number(),
});
export type CatalogoResult = z.infer<typeof catalogoResponseSchema>;

// Contrato de POST /inventarios y GET /inventarios/:id/estado de CORE — DOC-006 §3/§4.
export const postInventarioResponseSchema = z.object({
  inventarioId: z.string(),
  estado: z.enum(['pendiente', 'recibido', 'rechazado']),
});
export type PostInventarioResult = z.infer<typeof postInventarioResponseSchema>;

export const inventarioEstadoResponseSchema = z.object({
  estado: z.enum(['pendiente', 'recibido', 'rechazado']),
  ultimoIntento: z.string(),
});
export type InventarioEstadoResult = z.infer<
  typeof inventarioEstadoResponseSchema
>;

// Contrato de POST /activos de CORE — DOC-012 §5. `PostActivoRequest` es lo que CIS le manda a
// CORE (ya con `operadorId`/`rolesPorOrganizacion` resueltos, ver AdministradorService), no lo
// que WEB le manda a CIS (ese es AltaActivoBody, forma mas chica — sin esos dos campos).
export interface PostActivoRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
}

// Contrato de POST /contratos y PATCH /contratos/:id de CORE — DOC-012 §7. Mismo criterio que
// PostActivoRequest: CIS ya resolvio operadorId/rolesPorOrganizacion antes de armar esto.
export interface PostContratoRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  sedeIds: string[];
  vigenciaDesde: string;
  vigenciaHasta?: string | null;
  modulosContratados: string[];
}

export interface PatchContratoRequest {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  rolesPorOrganizacion: Record<string, string[]>;
  estado: string;
}

const sedeContratoSchema = z.object({ id: z.string(), nombre: z.string() });

export const contratoResponseSchema = z.object({
  id: z.string(),
  organizacionId: z.string(),
  organizacionNombre: z.string(),
  sedes: z.array(sedeContratoSchema),
  vigenciaDesde: z.string(),
  vigenciaHasta: z.string().nullable(),
  estado: z.enum(['vigente', 'suspendido', 'vencido', 'cancelado']),
  modulosContratados: z.array(z.string()),
});
export type ContratoResult = z.infer<typeof contratoResponseSchema>;
export const contratosResponseSchema = z.array(contratoResponseSchema);

// RF-04 (Fase 5, WEB) — GET /inventarios (listado) y GET /inventarios/:id (detalle) de CORE.
const sesionResumenSchema = z.object({
  id: z.string(),
  organizacionId: z.string(),
  areaId: z.string(),
  ubicacionId: z.string(),
  operadorId: z.string(),
  fechaInicio: z.string(),
  fechaCierre: z.string(),
  estado: z.enum(['pendiente', 'recibido', 'rechazado']),
  creadoEn: z.string(),
});
export type SesionResumenResult = z.infer<typeof sesionResumenSchema>;
export const sesionesResumenResponseSchema = z.array(sesionResumenSchema);

export const sesionDetalleResponseSchema = sesionResumenSchema.extend({
  escaneos: z.array(
    z.object({
      codigoQr: z.string(),
      resultado: z.string(),
      observaciones: z.string().nullable(),
    }),
  ),
});
export type SesionDetalleResult = z.infer<typeof sesionDetalleResponseSchema>;

// RF-06 (Fase 5, WEB) — contrato de GET /auditoria de CORE. Sin organizacionId (ver
// core/src/auditoria/auditoria.types.ts): la tabla audita cualquier operacion del ecosistema.
const auditoriaEntradaSchema = z.object({
  id: z.string(),
  usuario: z.string(),
  fecha: z.string(),
  equipo: z.string().nullable(),
  ip: z.string().nullable(),
  operacion: z.string(),
  resultado: z.string(),
  observaciones: z.string().nullable(),
});
export type AuditoriaEntradaResult = z.infer<typeof auditoriaEntradaSchema>;
export const auditoriaResponseSchema = z.array(auditoriaEntradaSchema);

export const activoResponseSchema = z.object({
  id: z.string(),
  codigoPatrimonial: z.string(),
  codigoQr: z.string(),
  organizacionId: z.string(),
  areaId: z.string().nullable(),
  ubicacionId: z.string().nullable(),
  responsableId: z.string().nullable(),
  estado: z.enum(['activo', 'en_transito', 'extraviado', 'dado_de_baja']),
  catalogo: z.object({
    tipo: z.string(),
    familia: z.string(),
    subfamilia: z.string().nullable(),
    marca: z.string().nullable(),
    modelo: z.string().nullable(),
  }),
});
export type ActivoResult = z.infer<typeof activoResponseSchema>;
