import { dialog, ipcMain, type BrowserWindow } from "electron";
import type {
  AltaDirectorInput,
  AltaDirectorResultado,
  AltaProfesionalAftInput,
  AltaProfesionalAftResultado,
  BootstrapClienteResultado,
  DatosClienteInput,
  EstadoIpLan,
  RectanguloPantalla,
} from "@shared/ipc-contract";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import type { AdminBootstrapKeycloak } from "../services/keycloak-service";
import {
  bootstrapPrimeraInstalacion,
  CLIENT_ID_APP_QR,
  CLIENT_ID_CCP,
  CLIENT_ID_CORE_FRONTEND,
  crearUsuarioDirector,
  crearUsuarioProfesionalAft,
  obtenerTokenClientCredentials,
  reconfigurarClientAppQr,
  resolverCredencialesClienteAdminCis,
  resolverCredencialesClienteIngesta,
} from "../keycloak-bootstrap";
import { reconfigurarWatcherIngesta } from "../services/ingesta-watcher";
import { PUERTO_RENDERER } from "../renderer-config";
import { PortalEmbebidoManager } from "../services/portal-login-service";
import {
  iniciarServidorEstatico,
  rutaDistDePortal,
} from "../services/static-portal-server";
import {
  PUERTO_CCP,
  PUERTO_CIS,
  PUERTO_CORE_FRONTEND,
} from "../services/backend-configs";
import { KEYCLOAK_CONFIG } from "../services/keycloak-service";
import {
  obtenerIpLan,
  obtenerOrigenAppQr,
  PUERTO_APP_QR,
} from "../services/lan-ip";
import { obtenerCertificadoAppQr } from "../services/appqr-tls";
import {
  actualizarCarpetaIngestaInstalacion,
  actualizarIpLanInstalacion,
  leerInstalacionExistente,
  marcarInstalacionCompleta,
} from "../services/instalacion-marker";
import { evaluarCambioIpLan } from "../services/ip-lan-guard";
import { provisionarOrganizacionCore } from "../services/core-provisioning";

// Todos los handlers reciben el ServiceOrchestrator ya arrancado -- ningún handler expone
// secretos al renderer (el admin de Keycloak, el client secret de cis-admin) más allá de lo que
// cada respuesta necesita explícitamente (ver comentario en shared/ipc-contract.ts sobre por qué
// el renderer nunca ve esos valores directo).
// Arranca una sola vez -- los servidores estáticos de los portales embebidos (ccp/core-frontend/
// app-qr) no dependen de ningún estado del wizard, a diferencia de cis (necesita las credenciales
// del bootstrap). Se postergan hasta el primer mostrarPortalEmbebido / getUrlAppQr en vez de
// arrancar junto con Postgres/Keycloak/cis/core/cip -- nadie los necesita antes del paso "listo".
//
// Se memoiza la PROMESA, no un booleano: mostrarPortalEmbebido y getUrlAppQr pueden entrar
// concurrentemente (y con React StrictMode, dos veces cada uno) antes de que el primer
// iniciarServidorEstatico() resuelva -- un `if (booleano) return` puesto después del await deja
// pasar a los dos y el segundo revienta con EADDRINUSE (bug real, 2026-08-29). Con la promesa
// memoizada todos esperan el mismo arranque.
let promesaServidoresPortales: Promise<void> | null = null;
let promesaServidorAppQr: Promise<void> | null = null;

// DOC-029 RF-B.6.2 -- credenciales del service account `sicsaft-ingesta` para el watcher de
// ingesta. El secret no se persiste (mismo criterio que cis-admin, ver
// resolverCredencialesClienteIngesta): se recupera de Keycloak la primera vez que hace falta y se
// cachea en memoria del proceso. `null` = todavía no se resolvió.
let credencialesIngesta: { clientId: string; secret: string } | null = null;

async function tokenServicioIngesta(
  admin: AdminBootstrapKeycloak,
): Promise<string> {
  credencialesIngesta ??= await resolverCredencialesClienteIngesta(admin);
  try {
    return await obtenerTokenClientCredentials(
      credencialesIngesta.clientId,
      credencialesIngesta.secret,
    );
  } catch {
    // El secret cacheado pudo quedar viejo (rotación manual desde la consola de Keycloak) --
    // reintentar una vez con credenciales frescas antes de dar el token por perdido.
    credencialesIngesta = await resolverCredencialesClienteIngesta(admin);
    return obtenerTokenClientCredentials(
      credencialesIngesta.clientId,
      credencialesIngesta.secret,
    );
  }
}

// Arranca (o reinicia, o apaga) el watcher de la carpeta de ingesta según el estado actual de
// instalacion.json. Se llama tras cada punto donde `carpetaIngesta` o los servicios pueden haber
// cambiado: fin del bootstrap, relanzamiento con wizard salteado, y cuando el usuario elige otra
// carpeta desde el wizard. El watcher es una comodidad de fondo -- si no arranca (Keycloak lento,
// carpeta borrada) se loguea y el `.exe` sigue: la carga manual de CSV desde el CCP es el camino
// alternativo permanente (DOC-029 B.6 "no se unifica la carga manual bajo staging").
async function asegurarWatcherIngesta(
  orquestador: ServiceOrchestrator,
): Promise<void> {
  try {
    const instalacion = leerInstalacionExistente();
    const carpeta = instalacion?.carpetaIngesta;
    const organizacionId = instalacion?.organizacionId;
    if (!carpeta || !organizacionId) {
      await reconfigurarWatcherIngesta(null);
      return;
    }
    const admin = orquestador.getKeycloakAdmin();
    await reconfigurarWatcherIngesta({
      carpeta,
      organizacionId,
      obtenerToken: () => tokenServicioIngesta(admin),
    });
  } catch (err: unknown) {
    console.error(
      "[sicsaft-core] No se pudo iniciar el watcher de ingesta contable:",
      err,
    );
  }
}

function asegurarServidoresPortales(): Promise<void> {
  promesaServidoresPortales ??= (async () => {
    // DOC-028 Fase C.0 -- la config OIDC de ccp/core-frontend se resuelve acá, en cada arranque, y
    // se inyecta en el index.html servido (static-portal-server.ts). El issuer lleva la IP de LAN
    // de ESTE arranque (KEYCLOAK_CONFIG.url ya la recalculó); si la IP cambió desde la
    // instalación, el portal igual apunta bien sin recompilar. cisUrl es 127.0.0.1 (loopback).
    const issuer = `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}`;
    const cisUrl = `http://127.0.0.1:${PUERTO_CIS}`;
    // DOC-029 RF-A -- nivel de producto contratado (DOC-025). Se persiste en instalacion.json al
    // hacer el bootstrap; una instalacion anterior a RF-A no lo tiene -> Nivel 1. Solo `ccp` lo
    // necesita: el portal del Directivo (core-frontend) es el mismo en todos los niveles.
    const instalacion = leerInstalacionExistente();
    const nivel = String(instalacion?.nivel ?? 1);
    // DOC-029 RF-B.6 -- carpeta vigilada de ingesta; string vacío si no se configuró todavía. El
    // módulo Importaciones del CCP la muestra (solo lectura); el watcher que la vigila vive en el
    // proceso principal, no en el portal.
    const carpetaIngesta = instalacion?.carpetaIngesta ?? "";
    await iniciarServidorEstatico({
      nombre: "ccp",
      distPath: rutaDistDePortal("ccp"),
      puerto: PUERTO_CCP,
      configRuntime: {
        VITE_KEYCLOAK_ISSUER: issuer,
        VITE_KEYCLOAK_CLIENT_ID: CLIENT_ID_CCP,
        VITE_CIS_URL: cisUrl,
        VITE_SICSAFT_NIVEL: nivel,
        VITE_SICSAFT_CARPETA_INGESTA: carpetaIngesta,
      },
    });
    await iniciarServidorEstatico({
      nombre: "core-frontend",
      distPath: rutaDistDePortal("core-frontend"),
      puerto: PUERTO_CORE_FRONTEND,
      configRuntime: {
        VITE_KEYCLOAK_ISSUER: issuer,
        VITE_KEYCLOAK_CLIENT_ID: CLIENT_ID_CORE_FRONTEND,
        VITE_CIS_URL: cisUrl,
      },
    });
    await asegurarServidorAppQr();
  })().catch((err: unknown) => {
    // Si el arranque falló de verdad, no dejar la promesa rechazada cacheada -- permitir que un
    // reintento (otro mostrarPortalEmbebido) lo vuelva a intentar.
    promesaServidoresPortales = null;
    throw err;
  });
  return promesaServidoresPortales;
}

// DOC-028 Fase D -- el .exe sirve también la PWA de app-qr-sicsaft, por HTTPS (cert autofirmado,
// appqr-tls.ts) y escuchando en la IP de LAN (el teléfono no llega a 127.0.0.1). El Profesional
// de AFT la abre escaneando el QR de la pantalla "listo" (PasoListoConLogin). Su config OIDC va
// inyectada como los otros portales (Fase C.0), pero con issuer y cisUrl en la IP de LAN, no en
// loopback: el consumidor corre en el teléfono, no en esta PC.
function asegurarServidorAppQr(): Promise<void> {
  promesaServidorAppQr ??= (async () => {
    const ipLan = obtenerIpLan();
    const tls = await obtenerCertificadoAppQr();
    await iniciarServidorEstatico({
      nombre: "app-qr-sicsaft",
      distPath: rutaDistDePortal("app-qr-sicsaft"),
      puerto: PUERTO_APP_QR,
      host: ipLan,
      tls,
      configRuntime: {
        VITE_KEYCLOAK_ISSUER: `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}`,
        VITE_KEYCLOAK_CLIENT_ID: CLIENT_ID_APP_QR,
        VITE_CIS_URL: `http://${ipLan}:${PUERTO_CIS}`,
      },
    });
  })().catch((err: unknown) => {
    promesaServidorAppQr = null;
    throw err;
  });
  return promesaServidorAppQr;
}

export function registrarIpcHandlers(
  orquestador: ServiceOrchestrator,
  ventana: BrowserWindow,
): void {
  const portalEmbebido = new PortalEmbebidoManager(ventana);

  ipcMain.handle("sicsaft-core:getEstadoServicios", () =>
    orquestador.getEstado(),
  );

  // DOC-028 Fase C.1 -- el wizard llama esto al relanzar, después de getInstalacionExistente(). Si
  // la IP de LAN de la PC cambió desde la instalación, devuelve cambio: true y el wizard muestra
  // PasoIpCambio antes del login. Backfill: una instalación anterior a Fase C no tiene ipLan
  // persistida -- se adopta la IP actual como línea base (no sabemos la vieja, asumir que la de
  // ahora está bien).
  ipcMain.handle("sicsaft-core:getEstadoIpLan", (): EstadoIpLan => {
    const estado = evaluarCambioIpLan();
    if (estado.ipGuardada === null && leerInstalacionExistente()) {
      actualizarIpLanInstalacion(estado.ipActual);
    }
    return estado;
  });

  // DOC-028 Fase C.1 -- reconfiguración de ~1 clic: re-registra el redirectUri/webOrigins del
  // client OIDC de la APP QR en Keycloak con la IP nueva y reescribe la ipLan del marcador.
  // Devuelve el estado ya reevaluado (cambio === false si salió bien).
  ipcMain.handle(
    "sicsaft-core:reconfigurarIpLan",
    async (): Promise<EstadoIpLan> => {
      const admin = orquestador.getKeycloakAdmin();
      await reconfigurarClientAppQr(admin, obtenerOrigenAppQr());
      actualizarIpLanInstalacion(obtenerIpLan());
      return evaluarCambioIpLan();
    },
  );

  // DOC-028 Fase D -- la pantalla "listo" (PasoListoConLogin) muestra un QR con esta URL para que
  // el Profesional de AFT abra la PWA de la APP QR desde el teléfono. De paso arranca el servidor
  // HTTPS de la APP QR si todavía no lo hizo, para que un escaneo inmediato encuentre algo.
  ipcMain.handle("sicsaft-core:getUrlAppQr", async (): Promise<string> => {
    await asegurarServidorAppQr();
    return obtenerOrigenAppQr();
  });

  // DOC-029 RF-B.6 -- carpeta vigilada de ingesta de Excel. El diálogo nativo es modal a la
  // ventana del wizard; si el usuario elige una carpeta, se persiste en instalacion.json y el
  // próximo arranque de servidores la inyecta a `ccp` (VITE_SICSAFT_CARPETA_INGESTA). El watcher
  // que corre el ETL Python por cada .xls nuevo vive en el proceso principal (ingesta-watcher.ts,
  // pendiente) -- este handler solo fija la ruta.
  ipcMain.handle(
    "sicsaft-core:elegirCarpetaIngesta",
    async (): Promise<string | null> => {
      const resultado = await dialog.showOpenDialog(ventana, {
        title: "Carpeta donde el especialista contable deja los Excel",
        properties: ["openDirectory", "createDirectory"],
      });
      if (resultado.canceled || resultado.filePaths.length === 0) return null;
      const carpeta = resultado.filePaths[0];
      actualizarCarpetaIngestaInstalacion(carpeta);
      // DOC-029 RF-B.6.2 -- reapuntar el watcher a la carpeta nueva sin reiniciar la app.
      await asegurarWatcherIngesta(orquestador);
      return carpeta;
    },
  );

  ipcMain.handle(
    "sicsaft-core:leerCarpetaIngesta",
    (): string | null => leerInstalacionExistente()?.carpetaIngesta ?? null,
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
      // DOC-029 RF-B.6.2 -- relanzamiento con el wizard salteado: si esta instalación ya tenía
      // una carpeta de ingesta configurada, el watcher tiene que volver a levantarse acá (no lo
      // hace nadie más en este camino).
      await asegurarWatcherIngesta(orquestador);
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
        // del wizard (PasoDatosCliente). Se inyecta al servir `ccp` como VITE_SICSAFT_NIVEL
        // (asegurarServidoresPortales): en Nivel 2 el CCP muestra la gestion avanzada. `web_admin`
        // NO se embebe en ningun nivel (decision del usuario 2026-09-02, ver DOC-030).
        nivel: input.nivel,
      });
      // DOC-029 RF-B.6.2 -- si el vendedor ya eligió la carpeta de ingesta antes de este paso,
      // dejar el watcher andando de una (si la elige después, elegirCarpetaIngesta lo levanta).
      await asegurarWatcherIngesta(orquestador);
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
