// Scaffold del realm `sicsaft` (paso 1-2 de Invoke-BootstrapCliente en
// devops/onprem/lib/Bootstrap-Keycloak.psm1) y la Organization de Keycloak del cliente -- ver
// keycloak-admin-api.ts para el porqué del wrapper `adminApi` compartido.

import { adminApi, idDeLocation } from "./keycloak-admin-api";
import { KEYCLOAK_CONFIG } from "./services/keycloak-service";

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
//
// 2026-09: "administrador-sistema" salió de esta lista al eliminarse el portal web_admin/ -- el
// CRUD de Organización/Contrato/Sede y la asignación de usuarios pasó a ser intervención directa
// del proveedor (BD / script con service-token) + este mismo wizard.
export const ROLES_DE_NEGOCIO = [
  "administrador-patrimonial",
  "directivo",
] as const;

// Paso 1-2 de Invoke-BootstrapCliente (Bootstrap-Keycloak.psm1): realm + scopes (organization
// promovido a default, cis-audience con Audience mapper) + roles. Corre una sola vez, al primer
// arranque de esta instalación — a diferencia del script de PowerShell (pensado para correr
// muchas veces, una por cliente onprem), acá cada instalación de sicsaft-core.exe es de un solo
// cliente, así que este paso se hace una vez y listo.
export async function crearRealmScaffold(token: string): Promise<void> {
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

export async function crearOrganizacion(
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

export async function resolverOrganizacionPorAlias(
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

export async function agregarMiembroSiHaceFalta(
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
