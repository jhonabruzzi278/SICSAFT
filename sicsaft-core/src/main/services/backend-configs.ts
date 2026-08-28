import { randomBytes } from "node:crypto";
import { POSTGRES_CONFIG } from "./postgres-service";
import { KEYCLOAK_CONFIG } from "./keycloak-service";
import { obtenerOrigenAppQr } from "./lan-ip";
import {
  rutaDistDeSistema,
  type NodeBackendConfig,
} from "./node-backend-service";

// Traducción directa de las env vars que hoy pasa devops/onprem/docker-compose.yml a cis/core/cip
// -- mismos nombres de variable, mismos valores lógicos, cambiando únicamente los hostnames de
// contenedor (`postgres`, `core`, `cip`, `id.${DOMINIO_BASE}`) por `127.0.0.1:<puerto fijo>` (acá
// no hay red de contenedores, todo corre en la misma PC). Puertos fijos no estándar, mismo
// criterio que POSTGRES_CONFIG/KEYCLOAK_CONFIG -- evitan chocar con instalaciones previas del
// cliente en la misma PC.
export const PUERTO_CIS = 56000;
export const PUERTO_CORE = 56001;
export const PUERTO_CIP = 56002;

// El auth servicio-a-servicio (CORE_SERVICE_TOKEN/CIP_SERVICE_TOKEN, ver
// core/src/common/auth/service-token.config.ts) no necesita persistir entre reinicios de la app:
// cis/core/cip siempre arrancan juntos como una unidad cada vez que abre sicsaft-core.exe, así que
// alcanza con generarlos una vez por arranque del proceso principal y compartirlos entre los 3
// backends de esa misma corrida -- equivalente a `openssl rand -hex 32` que devops/onprem/
// documenta en .env.example, pero generado en código en vez de tipeado a mano por instalación.
export function generarTokenServicio(): string {
  return randomBytes(32).toString("hex");
}

// CORE_DB_PASSWORD/CIP_DB_PASSWORD son campos requeridos por loadDatabaseConfig() (zod
// `.min(1)`) en core/ y cip/, pero el Postgres embebido corre con autenticación "trust" en
// 127.0.0.1 (ver postgres-service.ts inicializarSiHaceFalta -- initdb sin -A, TODO real pendiente
// de decidir si algún día hace falta un password de verdad). El valor acá es un placeholder no
// verificado por Postgres, solo para satisfacer el schema de cis/core/cip -- no es un secreto de
// seguridad real en este perfil embebido de un solo proceso local.
const DB_PASSWORD_PLACEHOLDER = "sicsaft-embebido-trust-auth";

export interface TokensServicio {
  coreServiceToken: string;
  cipServiceToken: string;
}

// EVENTOS_OUTBOX_DATABASE_URL (ADR-005) -- misma base `eventos_outbox` que
// crearBasesDeDatosSiHacenFalta() (postgres-bootstrap.ts) crea bajo el usuario admin único de
// este perfil embebido (ver DB_PASSWORD_PLACEHOLDER más arriba, mismo criterio de "trust auth
// local").
export function crearEventosOutboxUrl(): string {
  return (
    `postgres://${POSTGRES_CONFIG.usuarioAdmin}:${DB_PASSWORD_PLACEHOLDER}` +
    `@127.0.0.1:${POSTGRES_CONFIG.puerto}/eventos_outbox`
  );
}

export function crearConfigCore(
  eventosOutboxUrl: string,
  tokens: TokensServicio,
): NodeBackendConfig {
  return {
    nombre: "core",
    distMainPath: rutaDistDeSistema("core"),
    puerto: PUERTO_CORE,
    healthPath: "/health",
    env: {
      CORE_SERVICE_TOKEN: tokens.coreServiceToken,
      CORE_DB_HOST: "127.0.0.1",
      CORE_DB_PORT: String(POSTGRES_CONFIG.puerto),
      CORE_DB_NAME: "core",
      CORE_DB_USER: POSTGRES_CONFIG.usuarioAdmin,
      CORE_DB_PASSWORD: DB_PASSWORD_PLACEHOLDER,
      EVENTOS_OUTBOX_DATABASE_URL: eventosOutboxUrl,
    },
  };
}

export function crearConfigCip(
  eventosOutboxUrl: string,
  tokens: TokensServicio,
): NodeBackendConfig {
  return {
    nombre: "cip",
    distMainPath: rutaDistDeSistema("cip"),
    puerto: PUERTO_CIP,
    healthPath: "/health",
    env: {
      CIP_DB_HOST: "127.0.0.1",
      CIP_DB_PORT: String(POSTGRES_CONFIG.puerto),
      CIP_DB_NAME: "cip",
      CIP_DB_USER: POSTGRES_CONFIG.usuarioAdmin,
      CIP_DB_PASSWORD: DB_PASSWORD_PLACEHOLDER,
      CIP_SERVICE_TOKEN: tokens.cipServiceToken,
      CORE_URL: `http://127.0.0.1:${PUERTO_CORE}`,
      CORE_SERVICE_TOKEN: tokens.coreServiceToken,
      EVENTOS_OUTBOX_DATABASE_URL: eventosOutboxUrl,
    },
  };
}

// A diferencia de core/cip, cis no puede armarse en iniciarTodo(): necesita
// KEYCLOAK_ADMIN_CLIENT_ID/SECRET, que recién existen después de que el wizard corre
// bootstrapPrimeraInstalacion() (keycloak-bootstrap.ts) -- ver la nota de secuencia real en
// service-orchestrator.ts `iniciarCis`.
export function crearConfigCis(
  tokens: TokensServicio,
  adminCis: { clientId: string; secret: string },
): NodeBackendConfig {
  return {
    nombre: "cis",
    distMainPath: rutaDistDeSistema("cis"),
    puerto: PUERTO_CIS,
    healthPath: "/health",
    env: {
      KEYCLOAK_URL: KEYCLOAK_CONFIG.url,
      KEYCLOAK_REALM: KEYCLOAK_CONFIG.realm,
      // Constante fija, no generada -- bootstrapPrimeraInstalacion() (keycloak-bootstrap.ts) crea
      // el client scope "cis-audience" con un Audience mapper fijo a este mismo valor, igual que
      // ya hace lib/Bootstrap-Keycloak.psm1 en devops/onprem/.
      KEYCLOAK_AUDIENCE: "cis",
      CORE_URL: `http://127.0.0.1:${PUERTO_CORE}`,
      CORE_SERVICE_TOKEN: tokens.coreServiceToken,
      CIP_URL: `http://127.0.0.1:${PUERTO_CIP}`,
      CIP_SERVICE_TOKEN: tokens.cipServiceToken,
      KEYCLOAK_ADMIN_CLIENT_ID: adminCis.clientId,
      KEYCLOAK_ADMIN_CLIENT_SECRET: adminCis.secret,
      // CORE-RF-05 -- origen de la APP QR (PWA, `vite preview` en la IP de LAN), el mismo que
      // keycloak-bootstrap.ts usa para el redirect URI de su client OIDC ("app-qr-sicsaft"). Las
      // vistas embebidas de web_admin/core-frontend (CORE-RF-04) todavía no están cableadas en
      // este scaffold -- cuando lo estén, agregar sus orígenes acá también (lista separada por
      // comas, ver cis/src/main.ts).
      CIS_CORS_ORIGIN: obtenerOrigenAppQr(),
    },
  };
}
