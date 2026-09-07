import { z } from 'zod';

export const altaAreaSchema = z.object({
  codigo: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  dependencia: z.string().optional(),
  centroCosto: z.string().optional(),
});
export type AltaAreaForm = z.infer<typeof altaAreaSchema>;

export const actualizarAreaSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().optional(),
  dependencia: z.string().optional(),
  centroCosto: z.string().optional(),
  responsableId: z.string().optional(),
  ubicacionPrincipalId: z.string().optional(),
});
export type ActualizarAreaForm = z.infer<typeof actualizarAreaSchema>;

export const altaUbicacionSchema = z.object({
  sedeId: z.string().min(1, 'Requerido'),
  edificio: z.string().optional(),
  piso: z.string().optional(),
  areaId: z.string().optional(),
  oficina: z.string().optional(),
});
export type AltaUbicacionForm = z.infer<typeof altaUbicacionSchema>;

export const actualizarUbicacionSchema = z.object({
  edificio: z.string().optional(),
  piso: z.string().optional(),
  areaId: z.string().optional(),
  oficina: z.string().optional(),
  dependencia: z.string().optional(),
});
export type ActualizarUbicacionForm = z.infer<typeof actualizarUbicacionSchema>;

export const altaResponsableSchema = z.object({
  rut: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  cargo: z.string().min(1, 'Requerido'),
  areaId: z.string().min(1, 'Requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});
export type AltaResponsableForm = z.infer<typeof altaResponsableSchema>;

export const actualizarResponsableSchema = z.object({
  nombre: z.string().optional(),
  cargo: z.string().optional(),
  areaId: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
});
export type ActualizarResponsableForm = z.infer<typeof actualizarResponsableSchema>;
