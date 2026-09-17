// Bajo nivel HTTP contra la Admin API de Keycloak, compartido por keycloak-realm.ts,
// keycloak-clients.ts, keycloak-usuarios.ts y keycloak-ingesta.ts -- mismas llamadas a la Admin
// REST API de Keycloak, ya verificadas reales hoy (2026-08-27) contra un Keycloak 26.0 de prueba
// y contra el stack completo de devops/onprem/ (login real de un usuario, JWT validado por cis/).
// No se reinventa el diseño acá, solo el lenguaje de implementación — ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Qué se reusa tal cual".
//
// Diferencia real con el flujo de devops/onprem/: ahí el vendedor tipeaba
// KEYCLOAK_ADMIN_USERNAME/PASSWORD a mano en un .env; acá el proceso principal ya generó esas
// credenciales al arrancar keycloak-service.ts (ver AdminBootstrapKeycloak) y las pasa directo,
// sin que el vendedor las vea ni las escriba en ningún lado.

import type { AdminBootstrapKeycloak } from "./services/keycloak-service";
import { KEYCLOAK_CONFIG } from "./services/keycloak-service";

interface RespuestaConLocation {
  location: string | null;
}

// Bug real encontrado 2026-08-28: el /health/ready de Keycloak (ver keycloak-service.ts
// esperarListo) queda en verde un poco antes de que el endpoint de token del realm master esté
// realmente listo para responder -- se vio HTTP 500 real acá dos veces distintas, siempre justo
// después de que Keycloak recién termina de arrancar (crearBasesDeDatosSiHacenFalta/iniciarCis
// llamándolo apenas queda "listo"), nunca en corridas ya calientes. Reintenta unas pocas veces
// solo ante 5xx (fallo transitorio del lado de Keycloak) -- un 4xx (password real incorrecto) se
// propaga de inmediato, reintentarlo no cambiaría nada y ocultaría un error real.
const REINTENTOS_TOKEN_ADMIN = 5;
const ESPERA_ENTRE_REINTENTOS_MS = 800;

export async function obtenerTokenAdmin(
  admin: AdminBootstrapKeycloak,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: admin.usuario,
    password: admin.password,
  });
  let ultimoStatus = 0;
  for (let intento = 1; intento <= REINTENTOS_TOKEN_ADMIN; intento += 1) {
    const res = await fetch(
      `${KEYCLOAK_CONFIG.url}/realms/master/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
    );
    if (res.ok) {
      const data = (await res.json()) as { access_token: string };
      return data.access_token;
    }
    ultimoStatus = res.status;
    if (res.status < 500 || intento === REINTENTOS_TOKEN_ADMIN) break;
    await new Promise((r) => setTimeout(r, ESPERA_ENTRE_REINTENTOS_MS));
  }
  throw new Error(
    `No se pudo autenticar contra Keycloak (master): HTTP ${ultimoStatus}`,
  );
}

// DOC-029 RF-B.6.2 -- token `client_credentials` de un client confidencial del realm `sicsaft`
// (hoy solo `sicsaft-ingesta`, ver keycloak-ingesta.ts crearClientIngesta). Lo usa el proceso
// principal para armar el `--token` que le pasa al ETL Python: un JWT de servicio, sin usuario
// humano de por medio. Mismo endpoint de token que obtenerTokenAdmin pero contra el realm del
// cliente, no `master`, y con grant `client_credentials` en vez de `password`. Sin reintentos: se
// llama en caliente (Keycloak ya lleva rato arriba cuando el watcher procesa un archivo), no
// apenas Keycloak arranca.
export async function obtenerTokenClientCredentials(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(
    `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `No se pudo obtener un token client_credentials para '${clientId}': HTTP ${res.status}`,
    );
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// `path` siempre lo pasan llamadores internos de este archivo con literales fijos (los segmentos
// dinámicos son UUIDs que devuelve el propio Keycloak, nunca entrada del usuario ni del renderer,
// que solo llega hasta acá por IPC). La URL se arma con `new URL()` contra una base fija -- el
// `path` no se concatena crudo. (Hubo un intento de "lista blanca de primeros segmentos" que
// resultó frágil: rompía el bootstrap del realm al no incluir `default-optional-client-scopes` --
// enumerar a mano todos los endpoints de la Admin API que este archivo usa no es sostenible.)
export async function adminApi(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<RespuestaConLocation & { json: () => Promise<unknown> }> {
  const url = new URL(
    `admin/realms/${KEYCLOAK_CONFIG.realm}${path}`,
    `${KEYCLOAK_CONFIG.url}/`,
  );
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(
      `Keycloak Admin API ${method} ${path} -> HTTP ${res.status}: ${await res.text()}`,
    );
  }
  return { location: res.headers.get("location"), json: () => res.json() };
}

export function idDeLocation(location: string | null): string {
  if (!location) throw new Error("Keycloak no devolvió un header Location");
  const partes = location.split("/");
  const id = partes[partes.length - 1];
  if (!id) throw new Error(`Location con forma inesperada: ${location}`);
  return id;
}
