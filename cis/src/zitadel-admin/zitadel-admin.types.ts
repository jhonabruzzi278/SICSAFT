import { z } from 'zod';

// DOC-021 4 — formas minimas de la API de administracion de Zitadel (`/management/v1/...`) que
// este cliente necesita. Solo se declaran los campos que se usan — Zitadel devuelve bastante mas
// por objeto (metadata, timestamps, etc.), sin necesidad de modelarlo todo.
//
// ATENCION: estos shapes estan armados contra la documentacion publica de la API de Zitadel v1,
// sin verificar todavia contra una instancia real (a diferencia del resto de la integracion con
// Zitadel en este repo, que si esta verificada real — ver devops/local/README.md). Verificar
// contra un Zitadel real antes de confiar en produccion, ajustar de ser necesario.

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
