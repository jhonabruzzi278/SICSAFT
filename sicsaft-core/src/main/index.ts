import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { inspect } from "node:util";
import { ServiceOrchestrator } from "./services/service-orchestrator";
import { registrarIpcHandlers } from "./ipc/handlers";
import { detenerWatcherIngesta } from "./services/ingesta-watcher";
import {
  alRegistrar,
  cerrarLogger,
  iniciarLogger,
  registrar,
} from "./services/logger";

// Punto de entrada del proceso principal -- ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Primer arranque" para el flujo
// completo (splash mientras arrancan los servicios embebidos, wizard de alta del Director, alta
// del Profesional de AFT).

let ventanaPrincipal: BrowserWindow | null = null;
const orquestador = new ServiceOrchestrator();

// Una sola instancia por PC. Sin esto, abrir el `.exe` una segunda vez (doble clic al acceso
// directo, o "no pasó nada, lo abro de nuevo") levanta un segundo proceso completo: su Postgres
// embebido choca con el `postmaster.pid` del primero y el wizard muestra "Hubo un problema al
// iniciar" -- aunque la primera instancia esté sana. `requestSingleInstanceLock()` hace que la
// segunda invocación no arranque y solo traiga al frente la ventana que ya está.
const obtuvoLockUnicaInstancia = app.requestSingleInstanceLock();
if (!obtuvoLockUnicaInstancia) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!ventanaPrincipal) return;
    if (ventanaPrincipal.isMinimized()) ventanaPrincipal.restore();
    ventanaPrincipal.focus();
  });
}

// Marcado en 'before-quit': a partir de ahí no se empuja nada más al renderer (los servicios
// embebidos siguen emitiendo líneas de log y cambios de estado mientras se apagan, y su
// webContents ya puede estar destruido).
let appCerrandose = false;
// Se sueltan en 'before-quit' para dejar de escuchar durante el apagado.
let desuscribirLog: (() => void) | null = null;

// Empuja al renderer solo si la ventana y su webContents siguen vivos. `ventanaPrincipal?.` tapa
// la ventana en null pero NO un webContents ya destruido: al cerrar la app, esos listeners
// seguían disparando `.send()` sobre un objeto destruido -> "TypeError: Object has been
// destroyed" no capturado que abría el diálogo de crash de Electron (en cascada, uno por línea
// de log del apagado). Verificado real 2026-09-05.
function enviarAlRenderer(canal: string, ...args: unknown[]): void {
  if (appCerrandose) return;
  const wc = ventanaPrincipal?.webContents;
  if (!wc || wc.isDestroyed()) return;
  try {
    wc.send(canal, ...args);
  } catch {
    // La ventana pudo destruirse entre el chequeo y el send (cierre en curso) -- descartar.
  }
}

// Redirige todo `console.*` del proceso principal (este archivo, ipc/handlers.ts y cualquier
// servicio) también al log unificado. En un `.exe` que se abre con doble clic, stdout no lo ve
// nadie -- sin esto, el motivo real de un arranque fallido se pierde. Los originales se siguen
// llamando (stdout normal en `npm run dev`).
function engancharConsola(): void {
  const niveles = ["log", "info", "warn", "error", "debug"] as const;
  for (const nivel of niveles) {
    const original = console[nivel].bind(console);
    console[nivel] = (...args: unknown[]): void => {
      original(...args);
      const texto = args
        .map((a) =>
          a instanceof Error
            ? (a.stack ?? `${a.name}: ${a.message}`)
            : typeof a === "string"
              ? a
              : inspect(a, { depth: 4, breakLength: 120 }),
        )
        .join(" ");
      registrar("app", texto);
    };
  }
}

function crearVentana(): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // se muestra recién con 'ready-to-show' -- evita el flash de ventana en blanco
    webPreferences: {
      // contextIsolation + sandbox + nodeIntegration:false -- el renderer nunca tiene acceso
      // directo a Node/Electron, solo lo que preload/index.ts expone explícitamente vía
      // contextBridge (ver shared/ipc-contract.ts para el motivo: el renderer no es confiable con
      // secretos, mismo principio que ya aplica ADR-002/ADR-004 del lado del backend).
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // 2 bugs reales encontrados hoy con DevTools abierto, en cadena: (1) electron-vite
      // compilaba el preload a `index.mjs` con `"type": "module"` en package.json, mientras
      // esto apuntaba a `.js` -- ENOENT real. (2) Corregido a `.mjs`, Electron con
      // `sandbox: true` (ver webPreferences de acá abajo) no soporta ESM en preload bajo
      // ninguna extensión -- "Cannot use import statement outside a module" real, su loader
      // sandboxeado solo entiende CommonJS. Fix real: forzar el build del preload a CJS +
      // extensión `.cjs` en electron.vite.config.ts (Node/Electron siempre tratan `.cjs` como
      // CommonJS, sin importar "type": "module") -- acá apunta a esa misma extensión.
      preload: join(__dirname, "../preload/index.cjs"),
    },
  });

  ventana.once("ready-to-show", () => ventana.show());

  // electron-vite expone estas dos constantes global -- en dev apunta al servidor de Vite (HMR
  // real), en producción carga el HTML ya buildeado desde disco. Ninguna de las dos rutas usa
  // file:// como origin del contenido cargado en sí (el servidor de Vite en dev ya es
  // http://localhost:<puerto>) -- pendiente para producción real: servir el HTML/JS/CSS
  // buildeado también por un server http://127.0.0.1 propio en vez de loadFile con file://, para
  // no repetir el bug de secure context/crypto.subtle ya encontrado hoy (ver ARCHITECTURE.md
  // "Los 4 portales web", "Cuidado real, mismo tipo de bug").
  if (process.env.ELECTRON_RENDERER_URL) {
    void ventana.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void ventana.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Solo en dev -- diagnosticar una ventana en blanco sin esto obliga a que el vendedor sepa el
  // atajo de teclado o el menú de Electron; abrirlo solo hace más fácil ver errores reales del
  // renderer (CSP, excepciones de React, etc.) que nunca llegan a la terminal del proceso
  // principal.
  if (!app.isPackaged) {
    ventana.webContents.openDevTools({ mode: "detach" });
  }

  return ventana;
}

app.whenReady().then(async () => {
  // Segunda instancia: ya se llamó a app.quit() arriba, no arrancar nada (ni logger, ni ventana,
  // ni los servicios embebidos) -- la instancia que tiene el lock sigue siendo la única.
  if (!obtuvoLockUnicaInstancia) return;

  // Antes que nada -- abre el archivo de log del día y engancha console.* para que TODO lo que
  // pase de acá en adelante (arranque de servicios incluido) quede registrado. Un fallo acá (disco
  // lleno, permisos en %APPDATA%) NO debe impedir que la app abra: el log es una ayuda de
  // diagnóstico, no ruta crítica -- si no arranca, se sigue sin él.
  try {
    iniciarLogger();
    engancharConsola();
    registrar(
      "app",
      `SICSAFT CORE ${app.getVersion()} -- proceso principal listo`,
    );
  } catch (err: unknown) {
    console.error("[sicsaft-core] No se pudo iniciar el log de la app:", err);
  }

  ventanaPrincipal = crearVentana();
  registrarIpcHandlers(orquestador, ventanaPrincipal);

  orquestador.on("estado-cambio", (estado) => {
    enviarAlRenderer("sicsaft-core:estadoServiciosChanged", estado);
  });

  // Cada línea nueva del log unificado se empuja al renderer -- la Consola técnica la muestra en
  // vivo (útil mientras el arranque está en curso, no solo después de que falla).
  desuscribirLog = alRegistrar((linea) => {
    enviarAlRenderer("sicsaft-core:logLinea", linea);
  });

  try {
    await orquestador.iniciarTodo();
  } catch (err: unknown) {
    // No se cierra la app -- el wizard (renderer) recibe el estado de error vía
    // 'estado-cambio' y lo muestra (ver CORE-RNF-02: nunca una ventana en blanco sin feedback).
    // El error real (hoy: cis/core/cip sin integrar al orquestador, ver service-orchestrator.ts)
    // queda en el log de la app, no oculto.

    console.error("[sicsaft-core] Fallo iniciando servicios embebidos:", err);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0)
      ventanaPrincipal = crearVentana();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", async (event) => {
  // Da tiempo a que Postgres/Keycloak/cis/core/cip se apaguen limpio (ManagedProcess.detener usa
  // SIGTERM antes que SIGKILL, ver managed-process.ts) -- sin esto, cerrar la ventana de golpe
  // podría cortar Postgres a mitad de un write.
  event.preventDefault();
  // Dejar de empujar al renderer: la ventana se está por destruir y los servicios embebidos
  // siguen emitiendo líneas de log / cambios de estado mientras se apagan.
  appCerrandose = true;
  desuscribirLog?.();
  desuscribirLog = null;
  orquestador.removeAllListeners("estado-cambio");
  // DOC-029 RF-B.6.2 -- cerrar el watcher de ingesta antes que los servicios: deja de encolar
  // archivos y libera los handles de la carpeta vigilada.
  await detenerWatcherIngesta();
  await orquestador.detenerTodo();
  registrar("app", "--- sesión finalizada ---");
  cerrarLogger();
  app.exit(0);
});
