import { ipcMain, type BrowserWindow } from "electron";
import type {
  AltaDirectorInput,
  AltaDirectorResultado,
  AltaProfesionalAftInput,
  AltaProfesionalAftResultado,
  BootstrapClienteResultado,
  DatosClienteInput,
  RectanguloPantalla,
} from "@shared/ipc-contract";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import {
  bootstrapPrimeraInstalacion,
  crearUsuarioDirector,
  crearUsuarioProfesionalAft,
  resolverCredencialesClienteAdminCis,
} from "../keycloak-bootstrap";
import { PUERTO_RENDERER } from "../renderer-config";
import { PortalEmbebidoManager } from "../services/portal-login-service";
import {
  iniciarServidorEstatico,
  rutaDistDePortal,
} from "../services/static-portal-server";
import { PUERTO_CCP, PUERTO_CORE_FRONTEND } from "../services/backend-configs";
import {
  leerInstalacionExistente,
  marcarInstalacionCompleta,
} from "../services/instalacion-marker";

// Todos los handlers reciben el ServiceOrchestrator ya arrancado -- ningún handler expone
// secretos al renderer (el admin de Keycloak, el client secret de cis-admin) más allá de lo que
// cada respuesta necesita explícitamente (ver comentario en shared/ipc-contract.ts sobre por qué
// el renderer nunca ve esos valores directo).
// Arranca una sola vez -- los servidores estáticos de los portales embebidos (ccp/core-frontend)
// no dependen de ningún estado del wizard, a diferencia de cis (necesita las credenciales del
// bootstrap). Se posterga hasta el primer mostrarPortalEmbebido en vez de arrancar junto con
// Postgres/Keycloak/cis/core/cip -- nadie los necesita antes de llegar al paso "listo" del
// wizard.
let servidoresPortalesIniciados = false;

async function asegurarServidoresPortales(): Promise<void> {
  if (servidoresPortalesIniciados) return;
  await iniciarServidorEstatico({
    nombre: "ccp",
    distPath: rutaDistDePortal("ccp"),
    puerto: PUERTO_CCP,
  });
  await iniciarServidorEstatico({
    nombre: "core-frontend",
    distPath: rutaDistDePortal("core-frontend"),
    puerto: PUERTO_CORE_FRONTEND,
  });
  servidoresPortalesIniciados = true;
}

export function registrarIpcHandlers(
  orquestador: ServiceOrchestrator,
  ventana: BrowserWindow,
): void {
  const portalEmbebido = new PortalEmbebidoManager(ventana);

  ipcMain.handle("sicsaft-core:getEstadoServicios", () =>
    orquestador.getEstado(),
  );

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
    }
    return existente;
  });

  ipcMain.handle(
    "sicsaft-core:mostrarPortalEmbebido",
    async (
      _event,
      bounds: RectanguloPantalla,
      forzarNuevoLogin?: boolean,
    ): Promise<void> => {
      await asegurarServidoresPortales();
      await portalEmbebido.mostrarLoginYPortal(bounds, forzarNuevoLogin);
    },
  );

  ipcMain.on(
    "sicsaft-core:actualizarBoundsPortalEmbebido",
    (_event, bounds: RectanguloPantalla) => {
      portalEmbebido.actualizarBounds(bounds);
    },
  );

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
      // Ver instalacion-marker.ts -- de acá en más, un relanzamiento de la app salta directo al
      // login en vez de reintentar este paso (que rompería con 409, el realm ya existe).
      marcarInstalacionCompleta({
        organizacionId: resultado.organizacionId,
        clienteNombre: input.clienteNombre,
      });
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
  // endpoint real de cis/ (ver el comentario de crearUsuarioHumano en keycloak-bootstrap.ts).
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
