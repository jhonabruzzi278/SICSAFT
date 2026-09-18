import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
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

// Mapea la ruta resuelta a sí misma: el valor que llega a fs.stat() sale siempre de este Map
// (poblado únicamente por registrarSeleccion, desde dialog.showOpenDialog), nunca directo del
// string que manda el renderer por IPC -- aunque ambos terminen siendo el mismo valor, así corta
// la cadena de taint en el análisis estático (Set.has() + reusar la variable ya no alcanzaba,
// ver hallazgo tssecurity:S2083 en el PR).
const seleccionados = new Map<string, string>();

function registrarSeleccion(ruta: string): string {
  const absoluta = resolve(ruta);
  seleccionados.set(absoluta, absoluta);
  return absoluta;
}

async function validarArchivoSeleccionado(
  ruta: unknown,
  extensiones: readonly string[],
): Promise<string> {
  if (typeof ruta !== "string" || ruta.trim().length === 0) {
    throw new Error("Seleccioná un archivo válido.");
  }
  const absolutaConfiable = seleccionados.get(resolve(ruta));
  if (!absolutaConfiable) {
    throw new Error(
      "El archivo debe seleccionarse desde el diálogo de la aplicación.",
    );
  }
  if (!extensiones.includes(extname(absolutaConfiable).toLowerCase())) {
    throw new Error(
      `El archivo debe tener una de estas extensiones: ${extensiones.join(", ")}.`,
    );
  }
  const info = await stat(absolutaConfiable);
  if (!info.isFile()) throw new Error("La ruta seleccionada no es un archivo.");
  return absolutaConfiable;
}

function validarEntrada(input: unknown): input is GenerarInput {
  if (!input || typeof input !== "object") return false;
  const candidato = input as Partial<GenerarInput>;
  return (
    typeof candidato.rutaExcel === "string" &&
    typeof candidato.organizacionId === "string" &&
    candidato.organizacionId.trim().length > 0 &&
    (candidato.rutaMapeo === undefined ||
      typeof candidato.rutaMapeo === "string")
  );
}

ipcMain.handle("generador-qr:elegirExcel", async () => {
  const resultado = await dialog.showOpenDialog({
    title: "Elegir Excel de activos",
    filters: [{ name: "Excel", extensions: ["xls", "xlsx"] }],
    properties: ["openFile"],
  });
  if (resultado.canceled || resultado.filePaths.length === 0) return null;
  return registrarSeleccion(resultado.filePaths[0]);
});

ipcMain.handle("generador-qr:elegirMapeo", async () => {
  const resultado = await dialog.showOpenDialog({
    title: "Elegir mapeo-<cliente>.json (opcional)",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (resultado.canceled || resultado.filePaths.length === 0) return null;
  return registrarSeleccion(resultado.filePaths[0]);
});

ipcMain.handle(
  "generador-qr:generar",
  async (event, input: unknown): Promise<GenerarResultado | GenerarError> => {
    try {
      const rendererUrl = event.senderFrame?.url ?? "";
      const devUrl = process.env.ELECTRON_RENDERER_URL;
      const rendererPermitido = app.isPackaged
        ? rendererUrl.startsWith("file://")
        : rendererUrl.startsWith(devUrl ?? "http://localhost:");
      if (!rendererPermitido) throw new Error("Renderer no autorizado.");
      if (!validarEntrada(input))
        throw new Error("Datos de generación inválidos.");
      const rutaExcel = await validarArchivoSeleccionado(input.rutaExcel, [
        ".xls",
        ".xlsx",
      ]);
      const rutaMapeo = input.rutaMapeo
        ? await validarArchivoSeleccionado(input.rutaMapeo, [".json"])
        : undefined;
      const cuerpo = await generarEtiquetas(
        rutaExcel,
        input.organizacionId,
        rutaMapeo,
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
