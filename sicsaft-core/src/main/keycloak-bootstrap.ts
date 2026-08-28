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

import { randomBytes } from "node:crypto";
import type { AdminBootstrapKeycloak } from "./services/keycloak-service";
import { KEYCLOAK_CONFIG } from "./services/keycloak-service";
import { obtenerOrigenAppQr } from "./services/lan-ip";
import { PUERTO_CCP, PUERTO_CORE_FRONTEND } from "./services/backend-configs";

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

async function obtenerTokenAdmin(
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

// `path` siempre lo pasan llamadores internos de este archivo con literales fijos (los segmentos
// dinámicos son UUIDs que devuelve el propio Keycloak, nunca entrada del usuario ni del renderer,
// que solo llega hasta acá por IPC). La URL se arma con `new URL()` contra una base fija -- el
// `path` no se concatena crudo. (Hubo un intento de "lista blanca de primeros segmentos" que
// resultó frágil: rompía el bootstrap del realm al no incluir `default-optional-client-scopes` --
// enumerar a mano todos los endpoints de la Admin API que este archivo usa no es sostenible.)
async function adminApi(
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

function idDeLocation(location: string | null): string {
  if (!location) throw new Error("Keycloak no devolvió un header Location");
  const partes = location.split("/");
  const id = partes[partes.length - 1];
  if (!id) throw new Error(`Location con forma inesperada: ${location}`);
  return id;
}

// Bug real encontrado 2026-08-28: "profesional-aft" (el nombre que trae
// devops/onprem/lib/Bootstrap-Keycloak.psm1, portado acá tal cual) no lo usa ningún código real
// de cis/ ni de app-qr-sicsaft/ -- el rol que cis/ efectivamente asigna y valida para el
// Profesional de AFT es "administrador-patrimonial" (ver cis/src/directivo/directivo.constants.ts
// ADMINISTRADOR_PATRIMONIAL_ROLE, y los guards/páginas de ccp/ que lo exigen literal). Sin este
// rol creado en el realm, crearGrant() de cis/ agrega al usuario al grupo pero nunca puede
// asignarle el role mapping (el rol no existe) -- el JWT nunca trae el rol y
// portal-login-service.ts no puede rutear al usuario a ningún portal. Verificado real: "Designar
// Profesional de AFT" reportaba éxito igual (silencioso del lado de cis, gap aparte a revisar) sin
// que el rol quedara asignado de verdad.
const ROLES_DE_NEGOCIO = [
  "administrador-patrimonial",
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

// origen sin barra final, ej. "http://127.0.0.1:58090" o "http://10.31.89.92:8765" -- el
// parámetro pasó de "puertoRenderer" (solo desktop, siempre 127.0.0.1) a un origen completo para
// poder reusar esto también con la APP QR, que vive en la IP de LAN, no en loopback (ver
// crearClientAppQr).
async function crearClientPublico(
  token: string,
  clientId: string,
  origen: string,
): Promise<void> {
  await adminApi(token, "POST", "/clients", {
    clientId,
    name: clientId,
    protocol: "openid-connect",
    publicClient: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: false,
    redirectUris: [`${origen}/auth/callback`],
    webOrigins: [origen],
    attributes: {
      "pkce.code.challenge.method": "S256",
      "post.logout.redirect.uris": `${origen}/`,
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

async function crearClientAppQr(
  token: string,
  origenAppQr: string,
): Promise<void> {
  await crearClientPublico(token, CLIENT_ID_APP_QR, origenAppQr);
}

// CORE-RF-04 (alcance corregido 2026-08-28) -- clients propios para los portales embebidos.
// Cada uno vive en su propio origen 127.0.0.1:<puerto> (static-portal-server.ts) porque cada
// portal es un build Vite separado con su propio VITE_KEYCLOAK_CLIENT_ID -- mismo criterio que
// "app-qr-sicsaft" (un client por portal, nunca compartido) y no el client "sicsaft-core" del
// wizard, que es solo para el login inicial que detecta el rol (ver portal-login-service.ts).
export const CLIENT_ID_CCP = "ccp";
export const CLIENT_ID_CORE_FRONTEND = "core-frontend";

async function crearClientesPortales(token: string): Promise<void> {
  await crearClientPublico(
    token,
    CLIENT_ID_CCP,
    `http://127.0.0.1:${PUERTO_CCP}`,
  );
  await crearClientPublico(
    token,
    CLIENT_ID_CORE_FRONTEND,
    `http://127.0.0.1:${PUERTO_CORE_FRONTEND}`,
  );
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
  // "sicsaft-core" -- el wizard, y también el login único que detecta el rol antes de mostrar
  // el portal embebido correspondiente (CORE-RF-04, ver portal-login-service.ts). El
  // redirectUri acá nunca se sirve de verdad -- el login corre en un BrowserView que Electron
  // intercepta antes de que el navegador intente cargar esa URL, no hace falta que
  // puertoRenderer sea exacto (ver comentario de PUERTO_RENDERER en renderer-config.ts).
  await crearClientPublico(
    token,
    "sicsaft-core",
    `http://127.0.0.1:${puertoRenderer}`,
  );
  await crearClientAppQr(token, obtenerOrigenAppQr());
  // "ccp"/"core-frontend" -- clients propios de los portales embebidos, ver
  // crearClientesPortales() arriba.
  await crearClientesPortales(token);

  return { organizacionId, adminCis };
}

// Paso 2 del wizard ("alta del Director") — port de
// cis/src/keycloak-admin/keycloak-admin.service.ts `crearUsuarioHuman`/`crearGrant`, recortado a
// lo que este wizard necesita (crear el usuario + darle el rol "directivo" en su organización),
// no el `KeycloakAdminService` completo (listar grants, desactivar usuario, etc. no aplican acá).
// Mismo comportamiento verificado: password inicial de 20 caracteres sin ambigüedad visual,
// `temporary: true` (fuerza cambio en el primer login), y el modelo de "rol por organización" de
// ADR-004 (grupo `{organizacionId}::{rol}` con el realm role asignado al grupo — ver el
// comentario de KeycloakAdminService sobre por qué los realm roles de Keycloak son globales, no
// nativos por organización).

const LONGITUD_PASSWORD_INICIAL = 20;
// Debe calzar exacto con GRUPO_ORGANIZACION_ROL_SEPARADOR
// (cis/src/common/auth/keycloak-auth.constants.ts) -- keycloak-auth.guard.ts de cis/ interpreta
// los grupos de un usuario con este mismo separador para resolver sus roles por organización.
const GRUPO_ORGANIZACION_ROL_SEPARADOR = "::";
const ROL_DIRECTIVO = "directivo";
const ROL_ADMINISTRADOR_PATRIMONIAL = "administrador-patrimonial";

function generarPasswordInicial(): string {
  const alfabeto =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(LONGITUD_PASSWORD_INICIAL);
  let password = "";
  for (let i = 0; i < LONGITUD_PASSWORD_INICIAL; i += 1) {
    password += alfabeto[bytes[i] % alfabeto.length];
  }
  return password;
}

async function resolverOrganizacionPorAlias(
  token: string,
  organizacionId: string,
): Promise<{ id: string }> {
  const organizaciones = (await (
    await adminApi(token, "GET", "/organizations")
  ).json()) as Array<{ id: string; alias: string }>;
  const organizacion = organizaciones.find((o) => o.alias === organizacionId);
  if (!organizacion) {
    throw new Error(
      `No se encontró en Keycloak ninguna Organization con alias '${organizacionId}'`,
    );
  }
  return organizacion;
}

async function agregarMiembroSiHaceFalta(
  token: string,
  organizacionUuid: string,
  userId: string,
): Promise<void> {
  const res = await fetch(
    `${KEYCLOAK_CONFIG.url}/admin/realms/${KEYCLOAK_CONFIG.realm}/organizations/${organizacionUuid}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userId),
    },
  );
  // 409 = ya era miembro -- idempotente, no un error real (mismo criterio que
  // KeycloakAdminService.agregarMiembroSiHaceFalta). Cualquier otro status sí se propaga.
  if (!res.ok && res.status !== 409) {
    throw new Error(
      `No se pudo agregar el usuario a la Organization: HTTP ${res.status}`,
    );
  }
}

async function resolverOCrearGrupoRol(
  token: string,
  organizacionId: string,
  rol: string,
): Promise<string> {
  const nombre = `${organizacionId}${GRUPO_ORGANIZACION_ROL_SEPARADOR}${rol}`;
  const rolDef = (await (
    await adminApi(token, "GET", `/roles/${encodeURIComponent(rol)}`)
  ).json()) as { id: string; name: string };

  const gruposExistentes = (await (
    await adminApi(
      token,
      "GET",
      `/groups?search=${encodeURIComponent(nombre)}&exact=true`,
    )
  ).json()) as Array<{ id: string; name: string }>;
  const existente = gruposExistentes.find((g) => g.name === nombre);
  const grupoId = existente
    ? existente.id
    : idDeLocation(
        (await adminApi(token, "POST", "/groups", { name: nombre })).location,
      );

  // Asignar el role mapping SIEMPRE, no solo al crear el grupo -- POST role-mappings/realm es
  // idempotente en Keycloak (un rol ya presente no da error). Si el grupo ya existía de una
  // corrida anterior pero sin el mapping (p.ej. el rol se agregó a ROLES_DE_NEGOCIO después, ver
  // DOC-027 BUG-29), esto lo repara en vez de devolver un grupo que no otorga el rol -- misma
  // clase de gap silencioso que crearGrant() de cis/, cerrado acá para el camino porteado.
  await adminApi(token, "POST", `/groups/${grupoId}/role-mappings/realm`, [
    { id: rolDef.id, name: rolDef.name },
  ]);
  return grupoId;
}

export interface UsuarioHumanoCreado {
  userId: string;
  passwordInicial: string;
}

// Port recortado de KeycloakAdminService.crearUsuarioHuman/crearGrant (cis/src/keycloak-admin/):
// crea el usuario en Keycloak con un password inicial temporal (cambio obligatorio en el primer
// login), lo hace miembro de la Organization del cliente y le asigna el grupo
// `{organizacionId}::{rol}` -- que keycloak-auth.guard.ts de cis/ interpreta como "este usuario
// tiene `rol` en `organizacionId`". Se porta acá, en vez de llamar al endpoint real de cis/ por
// HTTP, porque el wizard corre estas altas con las credenciales de admin de Keycloak que ya
// tiene el proceso principal -- en el primer arranque todavía no hay un JWT de Director / Admin
// del Sistema con el que autenticarse contra el guard de ese endpoint.
export async function crearUsuarioHumano(
  admin: AdminBootstrapKeycloak,
  organizacionId: string,
  email: string,
  rol: string,
): Promise<UsuarioHumanoCreado> {
  const token = await obtenerTokenAdmin(admin);
  const passwordInicial = generarPasswordInicial();

  const creado = await adminApi(token, "POST", "/users", {
    username: email,
    email,
    enabled: true,
    emailVerified: true,
    firstName: email,
    lastName: email,
    credentials: [
      { type: "password", value: passwordInicial, temporary: true },
    ],
  });
  const userId = idDeLocation(creado.location);

  const organizacion = await resolverOrganizacionPorAlias(
    token,
    organizacionId,
  );
  await agregarMiembroSiHaceFalta(token, organizacion.id, userId);
  const grupoId = await resolverOCrearGrupoRol(token, organizacionId, rol);
  await adminApi(token, "PUT", `/users/${userId}/groups/${grupoId}`, {});

  return { userId, passwordInicial };
}

// Paso 2 del wizard -- rol "directivo".
export function crearUsuarioDirector(
  admin: AdminBootstrapKeycloak,
  organizacionId: string,
  email: string,
): Promise<UsuarioHumanoCreado> {
  return crearUsuarioHumano(admin, organizacionId, email, ROL_DIRECTIVO);
}

// Paso 3 del wizard -- rol "administrador-patrimonial" (el que cis/ asigna y ccp/ exige para el
// Profesional de AFT, ver DOC-027 BUG-29; NO "profesional-aft", que no lo usa ningún código real).
export function crearUsuarioProfesionalAft(
  admin: AdminBootstrapKeycloak,
  organizacionId: string,
  email: string,
): Promise<UsuarioHumanoCreado> {
  return crearUsuarioHumano(
    admin,
    organizacionId,
    email,
    ROL_ADMINISTRADOR_PATRIMONIAL,
  );
}
