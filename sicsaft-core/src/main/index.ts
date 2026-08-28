import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { ServiceOrchestrator } from "./services/service-orchestrator";
import { registrarIpcHandlers } from "./ipc/handlers";

// Punto de entrada del proceso principal -- ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Primer arranque" para el flujo
// completo (splash mientras arrancan los servicios embebidos, wizard de alta del Director, alta
// del Profesional de AFT).

let ventanaPrincipal: BrowserWindow | null = null;
const orquestador = new ServiceOrchestrator();

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
  ventanaPrincipal = crearVentana();
  registrarIpcHandlers(orquestador, ventanaPrincipal);

  orquestador.on("estado-cambio", (estado) => {
    ventanaPrincipal?.webContents.send(
      "sicsaft-core:estadoServiciosChanged",
      estado,
    );
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
  await orquestador.detenerTodo();
  app.exit(0);
});
