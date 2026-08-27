// Port a TypeScript de devops/onprem/lib/Bootstrap-Keycloak.psm1 — mismas llamadas a la Admin
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

async function obtenerTokenAdmin(
  admin: AdminBootstrapKeycloak,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: admin.usuario,
    password: admin.password,
  });
  const res = await fetch(
    `${KEYCLOAK_CONFIG.url}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(
      `No se pudo autenticar contra Keycloak (master): HTTP ${res.status}`,
    );
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function adminApi(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<RespuestaConLocation & { json: () => Promise<unknown> }> {
  const res = await fetch(
    `${KEYCLOAK_CONFIG.url}/admin/realms/${KEYCLOAK_CONFIG.realm}${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  if (!res.ok) {
    throw new Error(
      `Keycloak Admin API ${method} ${path} -> HTTP ${res.status}: ${await res.text()}`,
    );
  }
  return { location: res.headers.get("location"), json: () => res.json() };
}

function idDeLocation(location: string | null): string {
  if (!location) throw new Error("Keycloak no devolvió un header Location");
  const partes = location.split("/");
  const id = partes[partes.length - 1];
  if (!id) throw new Error(`Location con forma inesperada: ${location}`);
  return id;
}

const ROLES_DE_NEGOCIO = [
  "profesional-aft",
  "directivo",
  "administrador-sistema",
] as const;

// Paso 1-2 de Invoke-BootstrapCliente (Bootstrap-Keycloak.psm1): realm + scopes (organization
// promovido a default, cis-audience con Audience mapper) + roles. Corre una sola vez, al primer
// arranque de esta instalación — a diferencia del script de PowerShell (pensado para correr
// muchas veces, una por cliente onprem), acá cada instalación de sicsaft-core.exe es de un solo
// cliente, así que este paso se hace una vez y listo.
async function crearRealmScaffold(token: string): Promise<void> {
  const tokenMaster = token;
  const resRealm = await fetch(`${KEYCLOAK_CONFIG.url}/admin/realms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenMaster}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      realm: KEYCLOAK_CONFIG.realm,
      enabled: true,
      organizationsEnabled: true,
    }),
  });
  if (!resRealm.ok) {
    throw new Error(
      `No se pudo crear el realm '${KEYCLOAK_CONFIG.realm}': HTTP ${resRealm.status}`,
    );
  }

  const scopes = (await (
    await adminApi(token, "GET", "/client-scopes")
  ).json()) as Array<{
    id: string;
    name: string;
  }>;
  const orgScope = scopes.find((s) => s.name === "organization");
  if (!orgScope)
    throw new Error(
      "Keycloak no expuso el client scope 'organization' esperado",
    );
  await adminApi(
    token,
    "DELETE",
    `/default-optional-client-scopes/${orgScope.id}`,
  );
  await adminApi(token, "PUT", `/default-default-client-scopes/${orgScope.id}`);

  const audScopeLoc = await adminApi(token, "POST", "/client-scopes", {
    name: "cis-audience",
    protocol: "openid-connect",
    attributes: {
      "include.in.token.scope": "false",
      "display.on.consent.screen": "false",
    },
  });
  const audScopeId = idDeLocation(audScopeLoc.location);
  await adminApi(
    token,
    "POST",
    `/client-scopes/${audScopeId}/protocol-mappers/models`,
    {
      name: "cis-audience-mapper",
      protocol: "openid-connect",
      protocolMapper: "oidc-audience-mapper",
      config: {
        "included.custom.audience": "cis",
        "id.token.claim": "false",
        "access.token.claim": "true",
      },
    },
  );
  await adminApi(token, "PUT", `/default-default-client-scopes/${audScopeId}`);

  for (const rol of ROLES_DE_NEGOCIO) {
    await adminApi(token, "POST", "/roles", { name: rol });
  }
}

async function crearOrganizacion(
  token: string,
  clienteNombre: string,
  organizacionId: string,
): Promise<void> {
  await adminApi(token, "POST", "/organizations", {
    name: clienteNombre,
    alias: organizacionId,
    domains: [{ name: `${organizacionId}.sicsaft.invalid`, verified: false }],
  });
}

interface ClienteAdminCreado {
  clientId: string;
  secret: string;
}

// Client confidencial con service account que usa cis/ (KEYCLOAK_ADMIN_CLIENT_ID/SECRET) — mismo
// set de roles de realm-management verificado hoy como suficiente sin llegar al composite
// "realm-admin" completo (ver lib/Bootstrap-Keycloak.psm1 New-KeycloakAdminServiceAccount).
async function crearClientAdminCis(token: string): Promise<ClienteAdminCreado> {
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

async function crearClientPublico(
  token: string,
  clientId: string,
  puertoRenderer: number,
): Promise<void> {
  // A diferencia de devops/onprem/ (redirectUri con dominio/subdominio de Traefik), acá todo corre
  // dentro de la propia ventana de Electron en 127.0.0.1 — no hace falta un puerto por portal, el
  // renderer entero (wizard + vistas embebidas de web_admin/core-frontend) vive en un solo puerto.
  await adminApi(token, "POST", "/clients", {
    clientId,
    name: clientId,
    protocol: "openid-connect",
    publicClient: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    redirectUris: [`http://127.0.0.1:${puertoRenderer}/auth/callback`],
    webOrigins: [`http://127.0.0.1:${puertoRenderer}`],
    attributes: {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": `http://127.0.0.1:${puertoRenderer}/`,
    },
  });
}

export interface ResultadoBootstrap {
  organizacionId: string;
  adminCis: ClienteAdminCreado;
}

export async function bootstrapPrimeraInstalacion(
  admin: AdminBootstrapKeycloak,
  clienteNombre: string,
  organizacionId: string,
  puertoRenderer: number,
): Promise<ResultadoBootstrap> {
  const token = await obtenerTokenAdmin(admin);
  await crearRealmScaffold(token);
  await crearOrganizacion(token, clienteNombre, organizacionId);
  const adminCis = await crearClientAdminCis(token);
  // Solo "sicsaft-core" como client público de este incremento (Nivel 1, la ventana de Electron
  // misma) — a diferencia de devops/onprem/ que crea uno por portal, acá todos los portales viven
  // embebidos dentro de la misma ventana/origin, así que un solo client OIDC alcanza.
  await crearClientPublico(token, "sicsaft-core", puertoRenderer);

  return { organizacionId, adminCis };
}
