import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// DOC-021 4 (Administrador del Sistema) — integracion real con la API de administracion de
// Zitadel (`/management/v1/...`) para asignar usuarios a organizaciones sin salir a la Console.
//
// Autenticacion: Personal Access Token (PAT) de un service user con rol IAM/Org Manager en
// Zitadel — no client_credentials + JWT profile (mas complejo, exige una clave privada y un flujo
// de intercambio de token propio). Un PAT es un Bearer estatico, mismo nivel de complejidad
// operativa que CORE_SERVICE_TOKEN/CIP_SERVICE_TOKEN (secreto compartido, sin refresh), y es el
// mecanismo que Zitadel documenta para exactamente este caso (automatizacion server-to-server sin
// un usuario humano de por medio). Generado una vez en Zitadel Console (Users > Service User >
// Personal Access Tokens) — devops/local/README.md documenta los pasos exactos.
//
// ZITADEL_PROJECT_ID es el Resource Id del proyecto "CIS" en Zitadel (mismo proyecto que ya
// define los roles administrador-patrimonial/directivo/administrador-sistema) — necesario porque
// crear un grant en la API de Zitadel exige `projectId` + `roleKeys`, no solo el nombre del rol.
const zitadelAdminEnvSchema = z.object({
  ZITADEL_ISSUER: z.string().min(1, 'es requerido'),
  ZITADEL_ADMIN_TOKEN: z.string().min(1, 'es requerido'),
  ZITADEL_PROJECT_ID: z.string().min(1, 'es requerido'),
});

export interface ZitadelAdminConfig {
  issuer: string;
  token: string;
  projectId: string;
}

export function loadZitadelAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): ZitadelAdminConfig {
  const parsed = loadEnvConfig(zitadelAdminEnvSchema, env, 'ZitadelAdmin');
  return {
    issuer: parsed.ZITADEL_ISSUER,
    token: parsed.ZITADEL_ADMIN_TOKEN,
    projectId: parsed.ZITADEL_PROJECT_ID,
  };
}
