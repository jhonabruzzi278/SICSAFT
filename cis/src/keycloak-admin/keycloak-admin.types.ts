import { z } from 'zod';

// ADR-004 — formas mínimas de la Admin REST API de Keycloak (`/admin/realms/{realm}/...`) que
// este cliente necesita. Verificado real contra un Keycloak 26.6 de prueba (2026-08-26, ver
// notas de la Fase 1 de la implementación de ADR-004) — no contra la documentación pública sola:
//
// - Crear una Organization con un `id` propio en el body NO lo respeta: Keycloak siempre genera su
//   propio UUID interno. Lo que SÍ se puede fijar (y queda tal cual) es `alias` — por eso este
//   cliente usa `organizacionId` de CORE como `alias` de la Organization, nunca como `id`.
// - El claim `organization` del JWT (mapper `oidc-organization-membership-mapper`) es un array
//   plano de esos `alias` (ej. `["duoc-uc"]`), nunca del `id` interno — confirmado contra un token
//   real, no asumido de la documentación.
// - Los realm roles son globales por usuario (`realm_access.roles`), Keycloak NO tiene una forma
//   nativa de anidar "este rol aplica solo en esta organización" dentro del token — este cliente
//   lo resuelve con grupos: un grupo `{organizacionId}::{rol}` por combinación, con el realm role
//   asignado al grupo. Ver keycloak-admin.service.ts.

const organizacionSchema = z.object({
  id: z.string(),
  name: z.string(),
  alias: z.string(),
  enabled: z.boolean(),
});
export const organizacionResponseSchema = organizacionSchema;
export const organizacionesResponseSchema = z.array(organizacionSchema);
export interface OrganizacionKeycloak {
  id: string;
  name: string;
  alias: string;
  enabled: boolean;
}

const usuarioSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});
export const usuariosResponseSchema = z.array(usuarioSchema);
export interface UsuarioKeycloak {
  id: string;
  email: string | null;
  displayName: string | null;
}

const grupoSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string().optional(),
});
export const gruposResponseSchema = z.array(grupoSchema);
export interface GrupoKeycloak {
  id: string;
  name: string;
}

const rolSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export const rolResponseSchema = rolSchema;
export interface RolKeycloak {
  id: string;
  name: string;
}

export const tokenServicioResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

export interface GrantUsuario {
  userId: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}
