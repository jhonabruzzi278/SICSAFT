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
