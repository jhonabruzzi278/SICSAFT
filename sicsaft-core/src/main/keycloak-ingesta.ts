// DOC-029 RF-B.6.2 -- service account para el watcher de ingesta contable (ingesta-watcher.ts).
// Client confidencial con grant `client_credentials`: el proceso principal pide un JWT con estas
// credenciales (keycloak-admin-api.ts obtenerTokenClientCredentials) y se lo pasa al ETL Python
// como `--token`; el ETL postea el lote a CIS (POST /admin/importaciones/contable/lote). Para que
// ese POST pase el KeycloakAuthGuard de cis/ + la verificación de rol que hace CORE, el
// service-account user necesita exactamente lo mismo que un humano con rol en la organización:
//   - `aud: cis` en el token -> lo da el client scope `cis-audience` (default-default del realm,
//     ver keycloak-realm.ts crearRealmScaffold), sin tocar nada acá.
//   - claim `organization` con el alias del cliente -> el SA user tiene que ser miembro de la
//     Organization de Keycloak (agregarMiembroSiHaceFalta).
//   - rol `administrador-patrimonial` en esa organización -> el SA user en el grupo
//     `{organizacionId}::administrador-patrimonial` (resolverOCrearGrupoRol), que
//     keycloak-auth.guard.ts de cis/ interpreta como "este user tiene ese rol en esa org".
// La aprobación del lote la sigue haciendo un humano con su JWT real desde el CCP -- este service
// account solo deja el lote en `pendiente_revision` (DOC-016 5, "identidad sintética
// ingesta-contable" = lo que CIS reenvía a CORE como operadorId).
//
// PENDIENTE DE VERIFICACIÓN REAL (mismo criterio que el resto de este módulo, "verificado contra
// un Keycloak 26 real, no asumido de la doc"): que un token `client_credentials` incluya el claim
// `organization` del SA user. El mapper `oidc-organization-membership-mapper` vive en el client
// scope `organization` (default-default), así que debería aplicar también a client_credentials,
// pero no se pudo probar contra un Keycloak corriendo en este entorno -- si no lo trae, el guard
// de cis/ ve `organizaciones: []` y el POST del ETL da 403; el fallback sería un protocol-mapper
// "hardcoded claim" con el alias de la única organización de esta instalación.

import type { AdminBootstrapKeycloak } from "./services/keycloak-service";
import { adminApi, obtenerTokenAdmin } from "./keycloak-admin-api";
import {
  agregarMiembroSiHaceFalta,
  resolverOrganizacionPorAlias,
} from "./keycloak-realm";
import {
  resolverOCrearGrupoRol,
  ROL_ADMINISTRADOR_PATRIMONIAL,
} from "./keycloak-usuarios";

export const CLIENT_ID_INGESTA = "sicsaft-ingesta";

interface ClienteIngestaCreado {
  clientId: string;
  secret: string;
}

async function idClientIngesta(token: string): Promise<string> {
  const clientes = (await (
    await adminApi(token, "GET", `/clients?clientId=${CLIENT_ID_INGESTA}`)
  ).json()) as Array<{ id: string }>;
  const uuid = clientes[0]?.id;
  if (!uuid) {
    throw new Error(
      `No se encontró el client '${CLIENT_ID_INGESTA}' en Keycloak -- ¿el bootstrap de esta ` +
        "instalación se completó de verdad?",
    );
  }
  return uuid;
}

export async function crearClientIngesta(
  token: string,
  organizacionId: string,
): Promise<ClienteIngestaCreado> {
  await adminApi(token, "POST", "/clients", {
    clientId: CLIENT_ID_INGESTA,
    name: CLIENT_ID_INGESTA,
    protocol: "openid-connect",
    publicClient: false,
    standardFlowEnabled: false,
    implicitFlowEnabled: false,
    directAccessGrantsEnabled: false,
    serviceAccountsEnabled: true,
  });

  const clienteUuid = await idClientIngesta(token);
  const secretResp = (await (
    await adminApi(token, "GET", `/clients/${clienteUuid}/client-secret`)
  ).json()) as { value: string };
  const saUser = (await (
    await adminApi(token, "GET", `/clients/${clienteUuid}/service-account-user`)
  ).json()) as { id: string };

  const organizacion = await resolverOrganizacionPorAlias(
    token,
    organizacionId,
  );
  await agregarMiembroSiHaceFalta(token, organizacion.id, saUser.id);
  const grupoId = await resolverOCrearGrupoRol(
    token,
    organizacionId,
    ROL_ADMINISTRADOR_PATRIMONIAL,
  );
  await adminApi(token, "PUT", `/users/${saUser.id}/groups/${grupoId}`, {});

  return { clientId: CLIENT_ID_INGESTA, secret: secretResp.value };
}

// Recupera el client_secret de `sicsaft-ingesta` en un relanzamiento -- mismo patrón y mismo
// motivo que keycloak-clients.ts resolverCredencialesClienteAdminCis: el secret vive solo en
// memoria de la corrida que hizo el bootstrap, pero Keycloak lo tiene guardado y lo devuelve
// pidiéndoselo. El client ya existe con su rol/organización asignados desde crearClientIngesta --
// acá solo hace falta el secret.
export async function resolverCredencialesClienteIngesta(
  admin: AdminBootstrapKeycloak,
): Promise<ClienteIngestaCreado> {
  const token = await obtenerTokenAdmin(admin);
  const clienteUuid = await idClientIngesta(token);
  const secretResp = (await (
    await adminApi(token, "GET", `/clients/${clienteUuid}/client-secret`)
  ).json()) as { value: string };
  return { clientId: CLIENT_ID_INGESTA, secret: secretResp.value };
}
