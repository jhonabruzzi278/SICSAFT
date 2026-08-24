import { z } from 'zod';

// DOC-021 4 — formas minimas de la API de administracion de Zitadel (`/management/v1/...`) que
// este cliente necesita. Solo se declaran los campos que se usan — Zitadel devuelve bastante mas
// por objeto (metadata, timestamps, etc.), sin necesidad de modelarlo todo.
//
// Verificado real contra Zitadel v2.65 (DOC-022 4, 2026-08-19) — dos ajustes reales encontrados
// recien en ese momento, no solo contra la documentacion publica: `listarGrants` no tiene forma
// de filtrar por organizacion en la request (ver el comentario en `listarGrants` en
// zitadel-admin.service.ts) y `crearGrant` necesita el `id` del grant (agregado acá) para poder
// sumar un rol a un grant que ya existe en vez de crear uno nuevo (Zitadel modela un solo
// UserGrant por usuario+proyecto+organizacion).

const zitadelUserSchema = z.object({
  id: z.string(),
  userName: z.string().optional(),
  human: z
    .object({
      profile: z
        .object({
          displayName: z.string().optional(),
        })
        .optional(),
      email: z
        .object({
          email: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const buscarUsuariosResponseSchema = z.object({
  result: z.array(zitadelUserSchema).default([]),
});

export interface UsuarioZitadel {
  id: string;
  email: string | null;
  displayName: string | null;
}

const zitadelUserGrantSchema = z.object({
  id: z.string(),
  userId: z.string(),
  orgId: z.string(),
  projectId: z.string(),
  roleKeys: z.array(z.string()).default([]),
  userName: z.string().optional(),
  email: z.string().optional(),
  displayName: z.string().optional(),
});

export const listarGrantsResponseSchema = z.object({
  result: z.array(zitadelUserGrantSchema).default([]),
});

export interface GrantUsuario {
  userId: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

// Gap 1 (flujo real Admin->Directivo->Profesional AFT) — verificado real contra el Zitadel de
// devops/local (2026-08-20): `POST /management/v1/orgs { name }` devuelve exactamente esta forma,
// sin campo `name` de vuelta (el creador ya lo sabe).
export const crearOrganizacionResponseSchema = z.object({
  id: z.string(),
});
export interface OrganizacionZitadel {
  id: string;
}

// Gap 1 (flujo real Admin->Directivo->Profesional AFT) — hallazgo real al verificar contra el
// Zitadel de devops/local (2026-08-20), no documentado en el enunciado original: crear una
// Organización nueva no alcanza para que nadie pueda recibir un rol ahí — el proyecto "CIS" (dueño
// de los roles administrador-sistema/directivo/administrador-patrimonial) vive en la organización
// raíz ("DUOC UC"), y Zitadel exige un ProjectGrant explícito antes de poder emitir un UserGrant
// de ese proyecto para cualquier OTRA organización ("Project not found" si falta). Verificado real:
// `POST /management/v1/projects/{projectId}/grants { grantedOrgId, roleKeys }`, sin header
// `x-zitadel-orgid` (el PAT ya tiene permiso de instancia, no hace falta).
export const crearProjectGrantResponseSchema = z.object({
  grantId: z.string(),
});

// Mismo motivo que listarGrants: no hay forma de filtrar `_search` por `grantedOrgId` en la
// request (devuelve TODOS los ProjectGrants del proyecto) — se filtra en memoria.
const projectGrantSchema = z.object({
  grantId: z.string(),
  grantedOrgId: z.string(),
});
export const listarProjectGrantsResponseSchema = z.object({
  result: z.array(projectGrantSchema).default([]),
});

// Gap 3 (flujo real Admin->Directivo->Profesional AFT) — verificado real contra el Zitadel de
// devops/local (2026-08-20): `POST /management/v1/users/human` con
// `{ userName, profile: {firstName, lastName}, email: {email, isEmailVerified}, password:
// {password, changeRequired} }` devuelve exactamente esta forma. El usuario queda en estado
// "Initial" en la Console (mismo estado que un usuario creado a mano sin loguearse todavía) hasta
// su primer login — no es un error de creación, es el estado esperado de "contraseña inicial sin
// usar", consistente con `changeRequired: true`.
export const crearUsuarioHumanResponseSchema = z.object({
  userId: z.string(),
});
export interface UsuarioHumanCreado {
  userId: string;
}

// DOC-024 — verificado real contra el Zitadel de devops/local (2026-08-21):
// `GET /management/v1/users/{userId}` devuelve `{ user: { id, state, ... } }`. Usado por
// ZitadelAdminService.desactivarUsuario para decidir DELETE vs `_deactivate` — ver el comentario
// ahí sobre el hallazgo real "User with state initial can only be deleted not deactivated".
export const obtenerUsuarioResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    state: z.string(),
  }),
});
