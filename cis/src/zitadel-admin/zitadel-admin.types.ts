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
