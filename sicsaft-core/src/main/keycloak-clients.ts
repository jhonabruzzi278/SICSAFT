// Clients OIDC del realm `sicsaft`: el wizard/login (`sicsaft-core`, creado en keycloak-bootstrap.ts),
// el service account de `cis/` (cis-admin) y los públicos que usa cada portal/PWA (app-qr-sicsaft,
// ccp, core-frontend) -- ver keycloak-admin-api.ts para el porqué del wrapper `adminApi` compartido.

import { adminApi, obtenerTokenAdmin } from "./keycloak-admin-api";
import type { AdminBootstrapKeycloak } from "./services/keycloak-service";
import { obtenerOrigenCcpLan } from "./services/lan-ip";
import { PUERTO_CCP, PUERTO_CORE_FRONTEND } from "./services/backend-configs";

export interface ClienteAdminCreado {
  clientId: string;
  secret: string;
}

// Client confidencial con service account que usa cis/ (KEYCLOAK_ADMIN_CLIENT_ID/SECRET) — mismo
// set de roles de realm-management verificado hoy como suficiente sin llegar al composite
// "realm-admin" completo (ver lib/Bootstrap-Keycloak.psm1 New-KeycloakAdminServiceAccount).
export async function crearClientAdminCis(
  token: string,
): Promise<ClienteAdminCreado> {
  await adminApi(token, "POST", "/clients", {
    clientId: "cis-admin",
    name: "cis-admin",
    protocol: "openid-connect",
    publicClient: false,
    standardFlowEnabled: false,
    serviceAccountsEnabled: true,
    directAccessGrantsEnabled: false,
  });

  const clientes = (await (
    await adminApi(token, "GET", "/clients?clientId=cis-admin")
  ).json()) as Array<{
    id: string;
  }>;
  const clienteUuid = clientes[0]?.id;
  if (!clienteUuid)
    throw new Error("No se encontró el client 'cis-admin' recién creado");

  const secretResp = (await (
    await adminApi(token, "GET", `/clients/${clienteUuid}/client-secret`)
  ).json()) as { value: string };

  const saUser = (await (
    await adminApi(token, "GET", `/clients/${clienteUuid}/service-account-user`)
  ).json()) as { id: string };

  const rmClientes = (await (
    await adminApi(token, "GET", "/clients?clientId=realm-management")
  ).json()) as Array<{ id: string }>;
  const rmClienteUuid = rmClientes[0]?.id;
  if (!rmClienteUuid)
    throw new Error("No se encontró el client 'realm-management'");

  const nombresRoles = [
    "manage-users",
    "manage-realm",
    "query-groups",
    "query-users",
    "view-users",
  ];
  const roles = await Promise.all(
    nombresRoles.map((nombre) =>
      adminApi(token, "GET", `/clients/${rmClienteUuid}/roles/${nombre}`).then(
        (r) => r.json(),
      ),
    ),
  );
  await adminApi(
    token,
    "POST",
    `/users/${saUser.id}/role-mappings/clients/${rmClienteUuid}`,
    roles,
  );

  return { clientId: "cis-admin", secret: secretResp.value };
}

// Keycloak guarda varias post-logout redirect URIs en un solo atributo, separadas por "##".
const SEPARADOR_POST_LOGOUT = "##";

// Los tres campos de un client público que dependen de sus orígenes, armados siempre igual al
// crearlo (crearClientPublico) y al reescribirlo (reescribirOrigenesClient).
function camposDeOrigenes(origenes: readonly string[]): {
  redirectUris: string[];
  webOrigins: string[];
  postLogout: string;
} {
  return {
    redirectUris: origenes.map((origen) => `${origen}/auth/callback`),
    webOrigins: [...origenes],
    postLogout: origenes
      .map((origen) => `${origen}/`)
      .join(SEPARADOR_POST_LOGOUT),
  };
}

// origenes sin barra final, ej. ["http://127.0.0.1:58090"] o ["https://10.31.89.92:8765"] -- el
// parámetro pasó de "puertoRenderer" (solo desktop, siempre 127.0.0.1) a orígenes completos para
// reusar esto con la APP QR, que vive en la IP de LAN (ver crearClientAppQr), y con el CCP, que
// desde DOC-028 Fase G vive en los dos (ver origenesClientCcp).
export async function crearClientPublico(
  token: string,
  clientId: string,
  origenes: readonly string[],
): Promise<void> {
  const { redirectUris, webOrigins, postLogout } = camposDeOrigenes(origenes);
  await adminApi(token, "POST", "/clients", {
    clientId,
    name: clientId,
    protocol: "openid-connect",
    publicClient: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: true,
    serviceAccountsEnabled: false,
    redirectUris,
    webOrigins,
    attributes: {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": postLogout,
    },
  });
}

// CORE-RF-05 -- client OIDC propio para la APP QR (PWA de app-qr-sicsaft/, ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "La APK de Android"), separado del
// client "sicsaft-core" del wizard -- mismo criterio que devops/onprem/ (un client por portal,
// ver lib/Bootstrap-Keycloak.psm1 APP_QR_VITE_KEYCLOAK_CLIENT_ID). El origen es la IP de LAN de
// esta PC (ver keycloak-service.ts IP_LAN) porque el teléfono no puede alcanzar 127.0.0.1 de la
// PC del Director. PUERTO_APP_QR es el de `vite preview` de app-qr-sicsaft/ -- sicsaft-core
// todavía no arranca ese proceso (a diferencia de cis/core/cip, ver CORE-RF-04, pendiente),
// hoy se corre aparte a mano para probar la conexión real desde un teléfono.
export const CLIENT_ID_APP_QR = "app-qr-sicsaft";

export async function crearClientAppQr(
  token: string,
  origenAppQr: string,
): Promise<void> {
  await crearClientPublico(token, CLIENT_ID_APP_QR, [origenAppQr]);
}

// CORE-RF-04 (alcance corregido 2026-08-28) -- clients propios para los portales embebidos.
// Cada uno vive en su propio origen 127.0.0.1:<puerto> (static-portal-server.ts) porque cada
// portal es un build Vite separado con su propio VITE_KEYCLOAK_CLIENT_ID -- mismo criterio que
// "app-qr-sicsaft" (un client por portal, nunca compartido) y no el client "sicsaft-core" del
// wizard, que es solo para el login inicial que detecta el rol (ver portal-login-service.ts).
export const CLIENT_ID_CCP = "ccp";
export const CLIENT_ID_CORE_FRONTEND = "core-frontend";

// DOC-028 Fase G -- el CCP se sirve en dos orígenes: loopback (el portal embebido de la PC madre)
// y la IP de LAN por HTTPS (el puesto del Profesional de AFT en su propia PC). El client `ccp`
// tiene que aceptar volver a los dos. El Directivo sigue solo en loopback: su portal se usa en la
// PC madre.
export function origenesClientCcp(origenCcpLan: string): string[] {
  return [`http://127.0.0.1:${PUERTO_CCP}`, origenCcpLan];
}

export async function crearClientesPortales(token: string): Promise<void> {
  await crearClientPublico(
    token,
    CLIENT_ID_CCP,
    origenesClientCcp(obtenerOrigenCcpLan()),
  );
  await crearClientPublico(token, CLIENT_ID_CORE_FRONTEND, [
    `http://127.0.0.1:${PUERTO_CORE_FRONTEND}`,
  ]);
}

// Bug real encontrado 2026-08-28: iniciarCis() (service-orchestrator.ts) solo se llamaba desde el
// handler IPC `bootstrapCliente` -- en un relanzamiento de la app donde el wizard se saltea
// (instalacion-marker.ts ya tiene una instalación completa, ver WizardApp.tsx), ese handler nunca
// corre, así que cis nunca arrancaba. El client_secret de "cis-admin" que bootstrapPrimeraInstalacion
// generó la primera vez nunca se persiste en disco (vive solo en memoria de esa corrida) -- pero
// Keycloak SÍ lo tiene guardado en el client ya creado, así que se puede recuperar pidiéndoselo de
// nuevo a la Admin API en vez de necesitar guardarlo nosotros. A diferencia de crearClientAdminCis
// (que crea el client Y le asigna los roles de realm-management la primera vez), acá el client ya
// existe con sus roles ya asignados -- solo hace falta el secret.
export async function resolverCredencialesClienteAdminCis(
  admin: AdminBootstrapKeycloak,
): Promise<ClienteAdminCreado> {
  const token = await obtenerTokenAdmin(admin);
  const clientes = (await (
    await adminApi(token, "GET", "/clients?clientId=cis-admin")
  ).json()) as Array<{ id: string }>;
  const clienteUuid = clientes[0]?.id;
  if (!clienteUuid) {
    throw new Error(
      "No se encontró el client 'cis-admin' en Keycloak -- ¿esta instalación se completó de " +
        "verdad? (instalacion-marker.ts dice que sí, pero el client no está).",
    );
  }
  const secretResp = (await (
    await adminApi(token, "GET", `/clients/${clienteUuid}/client-secret`)
  ).json()) as { value: string };
  return { clientId: "cis-admin", secret: secretResp.value };
}

// Reescribe los orígenes de un client ya creado. PUT /clients/{id} exige la representación
// completa, así que se parte de la que devuelve Keycloak y se pisan solo los orígenes (más
// `extra`), conservando el resto de los attributes (pkce, etc.). Idempotente: correrlo con los
// orígenes que ya tenía no cambia nada. Reemplaza, no acumula -- la IP vieja no queda registrada.
async function reescribirOrigenesClient(
  token: string,
  clientId: string,
  origenes: readonly string[],
  extra: Record<string, unknown> = {},
): Promise<void> {
  const clientes = (await (
    await adminApi(token, "GET", `/clients?clientId=${clientId}`)
  ).json()) as Array<Record<string, unknown> & { id: string }>;
  const cliente = clientes[0];
  if (!cliente) {
    throw new Error(
      `No se encontró el client '${clientId}' en Keycloak -- ¿esta instalación se ` +
        "completó de verdad? (instalacion.json dice que sí, pero el client no está).",
    );
  }
  const { redirectUris, webOrigins, postLogout } = camposDeOrigenes(origenes);
  const attributesPrevios =
    (cliente.attributes as Record<string, unknown> | undefined) ?? {};
  await adminApi(token, "PUT", `/clients/${cliente.id}`, {
    ...cliente,
    ...extra,
    redirectUris,
    webOrigins,
    attributes: {
      ...attributesPrevios,
      "post.logout.redirect.uris": postLogout,
    },
  });
}

// DOC-028 Fase C.1 -- cuando la IP de LAN de la PC cambia (DHCP que reasigna), el client OIDC de
// la APP QR queda con redirectUris/webOrigins apuntando a la IP vieja y Keycloak rechaza el login
// del teléfono con "Invalid parameter: redirect_uri". `sicsaft-core` y `core-frontend` están
// registrados solo con orígenes 127.0.0.1, que no cambian nunca; `ccp` desde la Fase G también
// tiene uno de LAN -- lo resincroniza sincronizarOrigenesClientCcp.
export async function reconfigurarClientAppQr(
  admin: AdminBootstrapKeycloak,
  nuevoOrigenAppQr: string,
): Promise<void> {
  const token = await obtenerTokenAdmin(admin);
  await reescribirOrigenesClient(token, CLIENT_ID_APP_QR, [nuevoOrigenAppQr], {
    directAccessGrantsEnabled: true,
  });
}

// DOC-028 Fase G -- deja el client `ccp` con loopback + el origen de LAN actual. Se corre en cada
// relanzamiento y en la reconfiguración de IP (ipc/handlers-ip-lan.ts): cubre las instalaciones
// hechas antes de esta fase (su client solo tenía loopback) y los cambios de IP, sin reinstalar.
export async function sincronizarOrigenesClientCcp(
  admin: AdminBootstrapKeycloak,
  origenCcpLan: string,
): Promise<void> {
  const token = await obtenerTokenAdmin(admin);
  await reescribirOrigenesClient(
    token,
    CLIENT_ID_CCP,
    origenesClientCcp(origenCcpLan),
  );
}
