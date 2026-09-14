import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";
import { generarEtiquetas } from "./services/etl-runner";
import type {
  GenerarError,
  GenerarInput,
  GenerarResultado,
} from "../shared/ipc-contract";

// Punto de entrada del proceso principal — herramienta interna de escritorio, de un solo uso por
// corrida: elegir el Excel del cliente + su organizacionId, correr el ETL en modo dry-run
// (--salida -, nunca escribe en Postgres/CIS/CORE) e imprimir la hoja de etiquetas resultante.
// Sin backend, sin login, sin red -- todo local a esta PC (ver README.md).

function crearVentana(): BrowserWindow {
  const v = new BrowserWindow({
    width: 1200,
    height: 860,
    title: "SICSAFT — Generador de QR",
    webPreferences: {
      // Mismo principio de seguridad que sicsaft-core/ccp-desktop: el renderer no tiene Node ni
      // acceso directo a Electron, solo el puente tipado de preload/index.ts.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(__dirname, "../preload/index.cjs"),
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void v.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void v.loadFile(join(__dirname, "../renderer/index.html"));
  }

  if (!app.isPackaged) {
    v.webContents.openDevTools({ mode: "detach" });
  }

  return v;
}

ipcMain.handle("generador-qr:elegirExcel", async () => {
  const resultado = await dialog.showOpenDialog({
    title: "Elegir Excel de activos",
    filters: [{ name: "Excel", extensions: ["xls", "xlsx"] }],
    properties: ["openFile"],
  });
  if (resultado.canceled || resultado.filePaths.length === 0) return null;
  return resultado.filePaths[0];
});

ipcMain.handle("generador-qr:elegirMapeo", async () => {
  const resultado = await dialog.showOpenDialog({
    title: "Elegir mapeo-<cliente>.json (opcional)",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (resultado.canceled || resultado.filePaths.length === 0) return null;
  return resultado.filePaths[0];
});

ipcMain.handle(
  "generador-qr:generar",
  async (
    _event,
    input: GenerarInput,
  ): Promise<GenerarResultado | GenerarError> => {
    try {
      const cuerpo = await generarEtiquetas(
        input.rutaExcel,
        input.organizacionId,
        input.rutaMapeo,
      );
      return { ok: true, cuerpo };
    } catch (err: unknown) {
      return {
        ok: false,
        mensaje: err instanceof Error ? err.message : String(err),
      };
    }
  },
);

app.whenReady().then(() => {
  crearVentana();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      crearVentana();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
