import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import { X509Certificate } from "node:crypto";
import {
  buscarPcMadre,
  PUERTO_CCP_LAN_DEFAULT,
} from "./services/discovery-client";
import {
  leerConexionGuardada,
  guardarConexion,
} from "./services/conexion-store";
import { registrar } from "./services/logger";
import type { EstadoConexion } from "../shared/ipc-contract";

const obtuvoLockUnicaInstancia = app.requestSingleInstanceLock();
if (!obtuvoLockUnicaInstancia) app.quit();

let ventanaConexion: BrowserWindow | null = null;
let ventanaCcp: BrowserWindow | null = null;
type ModoConfianza =
  | { tipo: "fingerprint"; valor: string }
  | { tipo: "tofu" }
  | { tipo: "ninguno" };
let modoConfianza: ModoConfianza = { tipo: "ninguno" };
let conexionEnCurso: { ip: string; puertoCcp: number; nombre: string } | null =
  null;
let usandoConexionPersistida = false;

function enviarEstado(estado: EstadoConexion): void {
  if (!ventanaConexion?.isDestroyed())
    ventanaConexion?.webContents.send("ccp-desktop:estadoConexion", estado);
}

function crearVentanaConexion(): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 480,
    height: 380,
    resizable: false,
    title: "SICSAFT CCP",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(__dirname, "../preload/index.cjs"),
    },
  });
  if (process.env.ELECTRON_RENDERER_URL)
    void ventana.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void ventana.loadFile(join(__dirname, "../renderer/index.html"));
  if (!app.isPackaged) ventana.webContents.openDevTools({ mode: "detach" });
  return ventana;
}

function abrirVentanaCcp(ip: string, puertoCcp: number): void {
  ventanaCcp = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: "SICSAFT CCP",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  ventanaCcp.once("ready-to-show", () => {
    ventanaCcp?.show();
    ventanaConexion?.close();
    ventanaConexion = null;
  });
  ventanaCcp.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      registrar(
        "ccp",
        `Fallo cargando el CCP en https://${ip}:${puertoCcp} (${errorCode}): ${errorDescription}`,
      );
      ventanaCcp?.close();
      ventanaCcp = null;
      if (usandoConexionPersistida) {
        usandoConexionPersistida = false;
        void buscarYConectar();
        return;
      }
      enviarEstado({
        fase: "error",
        mensaje: `No se pudo cargar el CCP en ${ip}. Verificá que sicsaft-core.exe esté abierto en la PC madre.`,
      });
    },
  );
  void ventanaCcp.loadURL(`https://${ip}:${puertoCcp}`);
}

function conectar(
  ip: string,
  puertoCcp: number,
  nombre: string,
  confianza: ModoConfianza,
): void {
  modoConfianza = confianza;
  conexionEnCurso = { ip, puertoCcp, nombre };
  enviarEstado({ fase: "conectando", ip, nombre });
  abrirVentanaCcp(ip, puertoCcp);
}

app.on(
  "certificate-error",
  (event, _webContents, url, _error, certificate, callback) => {
    event.preventDefault();
    try {
      const fingerprintReal = new X509Certificate(certificate.data)
        .fingerprint256;
      if (
        modoConfianza.tipo === "fingerprint" &&
        fingerprintReal === modoConfianza.valor
      ) {
        registrar("cert", `Certificado verificado por fingerprint para ${url}`);
        callback(true);
        return;
      }
      if (modoConfianza.tipo === "tofu") {
        registrar(
          "cert",
          `Confianza en primer uso para ${url} -- fingerprint ${fingerprintReal}`,
        );
        if (conexionEnCurso)
          guardarConexion({ ...conexionEnCurso, fingerprint: fingerprintReal });
        callback(true);
        return;
      }
      registrar("cert", `RECHAZADO -- certificado no confiable para ${url}`);
      callback(false);
    } catch (err: unknown) {
      registrar("cert", `Error verificando el certificado de ${url}: ${err}`);
      callback(false);
    }
  },
);

async function buscarYConectar(): Promise<void> {
  enviarEstado({ fase: "buscando" });
  const respuesta = await buscarPcMadre();
  if (!respuesta) {
    enviarEstado({ fase: "sin-respuesta" });
    return;
  }
  guardarConexion({
    ip: respuesta.ip,
    puertoCcp: respuesta.puertoCcp,
    fingerprint: respuesta.fingerprint,
    nombre: respuesta.nombre,
  });
  conectar(respuesta.ip, respuesta.puertoCcp, respuesta.nombre, {
    tipo: "fingerprint",
    valor: respuesta.fingerprint,
  });
}

function esHostManualValido(ip: string): boolean {
  return /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)$/.test(ip);
}

ipcMain.handle("ccp-desktop:buscarDeNuevo", () => buscarYConectar());
ipcMain.handle("ccp-desktop:conectarManual", (_event, ip: unknown) => {
  if (typeof ip !== "string" || !esHostManualValido(ip.trim()))
    return { ok: false, error: "Ingresá una IP o nombre de host válido." };
  conectar(ip.trim(), PUERTO_CCP_LAN_DEFAULT, "Conexión manual", {
    tipo: "tofu",
  });
  return { ok: true };
});

app.whenReady().then(() => {
  if (!obtuvoLockUnicaInstancia) return;
  ventanaConexion = crearVentanaConexion();
  const guardada = leerConexionGuardada();
  if (guardada) {
    usandoConexionPersistida = true;
    conectar(guardada.ip, guardada.puertoCcp, guardada.nombre, {
      tipo: "fingerprint",
      valor: guardada.fingerprint,
    });
  } else void buscarYConectar();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0)
      ventanaConexion = crearVentanaConexion();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
