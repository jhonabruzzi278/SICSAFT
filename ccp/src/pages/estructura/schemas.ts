import { z } from 'zod';

// La sección de Ubicaciones que vivía en esta pantalla se quitó el 2026-09-13 (ver
// EstructuraPage.tsx) — sus schemas se eliminaron de acá junto con ella, no quedó ABM propio.

export const altaAreaSchema = z.object({
  codigo: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  dependencia: z.string().optional(),
  departamento: z.string().optional(),
  centroCosto: z.string().optional(),
});
export type AltaAreaForm = z.infer<typeof altaAreaSchema>;

// RF-05 (cierra el gap "ABM completo") — edición de Área, incluida la asignación de
// responsableId/ubicacionPrincipalId (DOC-005 2, el ciclo que el alta dejaba abierto a propósito).
// Ids en texto libre — esta sección no tiene cargada la lista de Responsables de la otra sección
// (vive con su propio scope de área), agregar un selector cruzado es más alcance del que este
// incremento necesita.
export const actualizarAreaSchema = z.object({
  codigo: z.string().optional(),
  nombre: z.string().optional(),
  dependencia: z.string().optional(),
  departamento: z.string().optional(),
  centroCosto: z.string().optional(),
  responsableId: z.string().optional(),
  ubicacionPrincipalId: z.string().optional(),
});
export type ActualizarAreaForm = z.infer<typeof actualizarAreaSchema>;

export const altaResponsableSchema = z.object({
  identificacion: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
  cargo: z.string().optional(),
  areaId: z.string().min(1, 'Requerido'),
  correo: z.string().email('Correo inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
});
export type AltaResponsableForm = z.infer<typeof altaResponsableSchema>;
