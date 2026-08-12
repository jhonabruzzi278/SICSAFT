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
