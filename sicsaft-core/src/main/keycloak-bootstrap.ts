// Orquesta el bootstrap de la primera instalación (paso 1 del wizard): realm + scopes + roles,
// la Organization del cliente, y los clients OIDC (cis-admin, sicsaft-ingesta, sicsaft-core,
// app-qr-sicsaft, ccp, core-frontend). Cada dominio vive en su propio archivo
// `keycloak-<dominio>.ts` -- ver aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md
// "Qué se reusa tal cual" para el porqué de portar devops/onprem/lib/Bootstrap-Keycloak.psm1 acá.

import type { AdminBootstrapKeycloak } from "./services/keycloak-service";
import { obtenerTokenAdmin } from "./keycloak-admin-api";
import { crearOrganizacion, crearRealmScaffold } from "./keycloak-realm";
import {
  type ClienteAdminCreado,
  crearClientAdminCis,
  crearClientAppQr,
  crearClientesPortales,
  crearClientPublico,
} from "./keycloak-clients";
import { crearClientIngesta } from "./keycloak-ingesta";
import { obtenerOrigenAppQr } from "./services/lan-ip";

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
  // DOC-029 RF-B.6.2 -- service account del watcher de ingesta contable. Se crea acá, junto al
  // resto de los clients del realm, porque necesita la Organization + el rol
  // `administrador-patrimonial` ya scaffoldeados arriba (crearRealmScaffold/crearOrganizacion). El
  // secret no se persiste (mismo criterio que cis-admin): se recupera con
  // resolverCredencialesClienteIngesta en cada relanzamiento.
  await crearClientIngesta(token, organizacionId);
  // "sicsaft-core" -- el wizard, y también el login único que detecta el rol antes de mostrar
  // el portal embebido correspondiente (CORE-RF-04, ver portal-login-service.ts). El
  // redirectUri acá nunca se sirve de verdad -- el login corre en un BrowserView que Electron
  // intercepta antes de que el navegador intente cargar esa URL, no hace falta que
  // puertoRenderer sea exacto (ver comentario de PUERTO_RENDERER en renderer-config.ts).
  await crearClientPublico(token, "sicsaft-core", [
    `http://127.0.0.1:${puertoRenderer}`,
  ]);
  await crearClientAppQr(token, obtenerOrigenAppQr());
  // "ccp"/"core-frontend" -- clients propios de los portales embebidos, ver
  // keycloak-clients.ts crearClientesPortales().
  await crearClientesPortales(token);

  return { organizacionId, adminCis };
}
