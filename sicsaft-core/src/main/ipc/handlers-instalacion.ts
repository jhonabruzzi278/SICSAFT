// Canales IPC del wizard de primera instalación: relanzamiento con wizard salteado, bootstrap
// completo del cliente (Keycloak + BPI), y alta del Director / Profesional de AFT.

import { ipcMain } from "electron";
import type {
  AltaDirectorInput,
  AltaDirectorResultado,
  AltaProfesionalAftInput,
  AltaProfesionalAftResultado,
  BootstrapClienteResultado,
  DatosClienteInput,
} from "@shared/ipc-contract";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import { bootstrapPrimeraInstalacion } from "../keycloak-bootstrap";
import { resolverCredencialesClienteAdminCis } from "../keycloak-clients";
import {
  crearUsuarioDirector,
  crearUsuarioProfesionalAft,
} from "../keycloak-usuarios";
import { PUERTO_RENDERER } from "../renderer-config";
import {
  leerInstalacionExistente,
  marcarInstalacionCompleta,
} from "../services/instalacion-marker";
import { provisionarOrganizacionCore } from "../services/core-provisioning";
import { obtenerIpLan } from "../services/lan-ip";

export interface HandlersInstalacionDeps {
  asegurarServidoresPortales: () => Promise<void>;
  asegurarWatcherIngesta: () => Promise<void>;
}

export function registrarHandlersInstalacion(
  orquestador: ServiceOrchestrator,
  {
    asegurarServidoresPortales,
    asegurarWatcherIngesta,
  }: HandlersInstalacionDeps,
): void {
  ipcMain.handle("sicsaft-core:getInstalacionExistente", async () => {
    const existente = leerInstalacionExistente();
    if (existente) {
      // Bug real encontrado 2026-08-28: cis solo arrancaba desde bootstrapCliente -- en un
      // relanzamiento donde el wizard se saltea (esta rama) eso nunca corre, así que cis se
      // quedaba abajo para siempre. El client_secret nunca se persiste (ver el comentario de
      // resolverCredencialesClienteAdminCis), se recupera de nuevo contra la Admin API acá mismo.
      const admin = orquestador.getKeycloakAdmin();
      const adminCis = await resolverCredencialesClienteAdminCis(admin);
      await orquestador.iniciarCis(adminCis);
      // DOC-029 RF-B.6.2 -- relanzamiento con el wizard salteado: si esta instalación ya tenía
      // una carpeta de ingesta configurada, el watcher tiene que volver a levantarse acá (no lo
      // hace nadie más en este camino).
      await asegurarWatcherIngesta();
      await asegurarServidoresPortales();
    }
    return existente;
  });

  ipcMain.handle(
    "sicsaft-core:bootstrapCliente",
    async (
      _event,
      input: DatosClienteInput,
    ): Promise<BootstrapClienteResultado> => {
      const admin = orquestador.getKeycloakAdmin();
      const resultado = await bootstrapPrimeraInstalacion(
        admin,
        input.clienteNombre,
        input.organizacionId,
        PUERTO_RENDERER,
      );
      // cis recién puede arrancar acá -- necesita el client "cis-admin" (KEYCLOAK_ADMIN_CLIENT_ID/
      // SECRET) que bootstrapPrimeraInstalacion() acaba de crear, ver la nota de secuencia en
      // service-orchestrator.ts iniciarCis(). El wizard espera a que quede "listo" antes de
      // avanzar al siguiente paso (alta del Director, que si necesita cis arriba en el futuro
      // pasaría a llamarlo directo -- hoy altaDirector todavía no depende de cis, ver más abajo).
      await orquestador.iniciarCis(resultado.adminCis);
      // DOC-028 Fase B.2 -- además de la Organization de Keycloak, crea la organización + contrato
      // vigente + sede principal en la Base Patrimonial de CORE. Sin esto el Profesional de AFT no
      // ve el catálogo de su organización (la base arranca vacía desde Fase B.1). Antes de
      // marcarInstalacionCompleta: si esto falla, el wizard muestra el error y se puede reintentar
      // el paso 1 (los INSERT son idempotentes por ON CONFLICT).
      await provisionarOrganizacionCore({
        organizacionId: resultado.organizacionId,
        clienteNombre: input.clienteNombre,
        sedePrincipalNombre: input.sedePrincipalNombre,
      });
      // Ver instalacion-marker.ts -- de acá en más, un relanzamiento de la app salta directo al
      // login en vez de reintentar este paso (que rompería con 409, el realm ya existe). `ipLan`
      // (DOC-028 Fase C.1) queda como línea base: cada relanzamiento la compara con la IP actual
      // para saber si hay que reconfigurar el client OIDC de la APP QR.
      marcarInstalacionCompleta({
        organizacionId: resultado.organizacionId,
        clienteNombre: input.clienteNombre,
        ipLan: obtenerIpLan(),
        // DOC-030 -- nivel de producto contratado (DOC-025), elegido por el vendedor en el paso 1
        // del wizard (PasoDatosCliente). Se inyecta a los portales como VITE_SICSAFT_NIVEL
        // (asegurarServidoresPortales): el CCP va completo en todos los niveles y no lo mira;
        // Nivel 2 agrega el CIP, que es el tablero del **Directivo** y solo se ve desde su portal
        // (correccion 2026-09-09, ver core/frontend/src/lib/nivel.ts y ccp/src/lib/nivel.ts).
        // El portal `web_admin` se eliminó por completo (2026-09, ver DOC-030) -- el CRUD de
        // Organizacion/Contrato/Sede es intervencion directa del proveedor + el wizard.
        nivel: input.nivel,
      });
      // DOC-029 RF-B.6.2 -- si el vendedor ya eligió la carpeta de ingesta antes de este paso,
      // dejar el watcher andando de una (si la elige después, elegirCarpetaIngesta lo levanta).
      await asegurarWatcherIngesta();
      return { organizacionId: resultado.organizacionId };
    },
  );

  ipcMain.handle(
    "sicsaft-core:altaDirector",
    async (
      _event,
      input: AltaDirectorInput,
    ): Promise<AltaDirectorResultado> => {
      const admin = orquestador.getKeycloakAdmin();
      return crearUsuarioDirector(admin, input.organizacionId, input.email);
    },
  );

  // Paso 3 -- mismo patrón que altaDirector, rol "administrador-patrimonial". cis/ ya corre
  // embebido en este punto (lo arrancó bootstrapCliente), pero el alta se hace igual contra la
  // Admin API de Keycloak: en el wizard no hay un JWT de Director con el que pasar el guard del
  // endpoint real de cis/ (ver el comentario de crearUsuarioHumano en keycloak-usuarios.ts).
  ipcMain.handle(
    "sicsaft-core:altaProfesionalAft",
    async (
      _event,
      input: AltaProfesionalAftInput,
    ): Promise<AltaProfesionalAftResultado> => {
      const admin = orquestador.getKeycloakAdmin();
      return crearUsuarioProfesionalAft(
        admin,
        input.organizacionId,
        input.email,
      );
    },
  );
}
