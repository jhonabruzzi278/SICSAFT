// Canales IPC de los portales embebidos (ccp/core-frontend), la PWA de la APP QR y el puesto del
// Profesional de AFT en la LAN (DOC-028 Fase G). Arranca los servidores estáticos de forma
// perezosa (memoizando la promesa) y expone `asegurarServidoresPortales` para que
// handlers-instalacion.ts pueda garantizar que estén arriba antes de mostrar un portal.

import { app, dialog, ipcMain, type BrowserWindow } from "electron";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  InfoAppQr,
  InfoPuestoAft,
  RectanguloPantalla,
} from "@shared/ipc-contract";
import {
  CLIENT_ID_APP_QR,
  CLIENT_ID_CCP,
  CLIENT_ID_CORE_FRONTEND,
} from "../keycloak-clients";
import { PortalEmbebidoManager } from "../services/portal-login-service";
import {
  iniciarServidorEstatico,
  rutaArchivoApk,
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
  obtenerOrigenCcpLan,
  PUERTO_APP_QR,
  PUERTO_CCP_LAN,
} from "../services/lan-ip";
import { obtenerCertificadoAppQr } from "../services/appqr-tls";
import {
  contenidoAccesoDirecto,
  NOMBRE_ACCESO_DIRECTO,
} from "../services/acceso-directo";
import { leerInstalacionExistente } from "../services/instalacion-marker";

// DOC-028 Fase G -- rutas del proxy de mismo origen del CCP servido en la LAN (ver
// asegurarServidorCcpLan). El portal las recibe ya armadas en su config runtime.
const RUTA_PROXY_CIS = "/cis";
const RUTA_PROXY_TOKEN = "/kc/token";

function issuerDelRealm(): string {
  return `${KEYCLOAK_CONFIG.url}/realms/${KEYCLOAK_CONFIG.realm}`;
}

// DOC-029 RF-A / RF-B.6 -- lo que el CCP lee de instalacion.json, igual en sus dos servidores
// (loopback y, desde DOC-028 Fase G, LAN). Nivel de producto (DOC-025): se persiste en el
// bootstrap; una instalación anterior a RF-A no lo tiene -> Nivel 1. Carpeta vigilada de ingesta:
// string vacío si no se configuró todavía; el módulo Importaciones del CCP la muestra (solo
// lectura), el watcher que la vigila vive en el proceso principal, no en el portal.
function configCcpDeInstalacion(): Record<string, string> {
  const instalacion = leerInstalacionExistente();
  return {
    VITE_SICSAFT_NIVEL: String(instalacion?.nivel ?? 1),
    VITE_SICSAFT_CARPETA_INGESTA: instalacion?.carpetaIngesta ?? "",
  };
}

export interface HandlersPortales {
  asegurarServidoresPortales: () => Promise<void>;
}

export function registrarHandlersPortales(
  ventana: BrowserWindow,
): HandlersPortales {
  const portalEmbebido = new PortalEmbebidoManager(ventana);

  // Se postergan hasta el primer mostrarPortalEmbebido / getUrlAppQr en vez de arrancar junto con
  // Postgres/Keycloak/cis/core/cip -- nadie los necesita antes del paso "listo".
  //
  // Se memoiza la PROMESA, no un booleano: mostrarPortalEmbebido y getUrlAppQr pueden entrar
  // concurrentemente (y con React StrictMode, dos veces cada uno) antes de que el primer
  // iniciarServidorEstatico() resuelva -- un `if (booleano) return` puesto después del await deja
  // pasar a los dos y el segundo revienta con EADDRINUSE (bug real, 2026-08-29). Con la promesa
  // memoizada todos esperan el mismo arranque.
  let promesaServidoresPortales: Promise<void> | null = null;
  let promesaServidorAppQr: Promise<void> | null = null;
  let promesaServidorCcpLan: Promise<void> | null = null;

  // DOC-028 Fase D -- el .exe sirve también la PWA de app-qr-sicsaft, por HTTPS (cert autofirmado,
  // appqr-tls.ts) y escuchando en la IP de LAN (el teléfono no llega a 127.0.0.1). El Profesional
  // de AFT la abre escaneando el QR de la pantalla "listo" (PasoListoConLogin). Su config OIDC va
  // inyectada como los otros portales (Fase C.0), pero con issuer y cisUrl en la IP de LAN, no en
  // loopback: el consumidor corre en el teléfono, no en esta PC.
  function asegurarServidorAppQr(): Promise<void> {
    promesaServidorAppQr ??= (async () => {
      const ipLan = obtenerIpLan();
      const origen = `https://${ipLan}:${PUERTO_APP_QR}`;
      const issuer = issuerDelRealm();
      const tls = await obtenerCertificadoAppQr();
      await iniciarServidorEstatico({
        nombre: "app-qr-sicsaft",
        distPath: rutaDistDePortal("app-qr-sicsaft"),
        puerto: PUERTO_APP_QR,
        host: ipLan,
        tls,
        configRuntime: {
          VITE_KEYCLOAK_ISSUER: issuer,
          VITE_KEYCLOAK_CLIENT_ID: CLIENT_ID_APP_QR,
          // La PWA se abre por HTTPS: token y API deben conservar el mismo origen para que
          // Android WebView no bloquee estos fetch como contenido mixto.
          VITE_KEYCLOAK_TOKEN_URL: `${origen}${RUTA_PROXY_TOKEN}`,
          VITE_CIS_URL: `${origen}${RUTA_PROXY_CIS}`,
        },
        proxies: [
          {
            prefijo: RUTA_PROXY_CIS,
            destino: `http://127.0.0.1:${PUERTO_CIS}`,
          },
          {
            prefijo: RUTA_PROXY_TOKEN,
            destino: `${issuer}/protocol/openid-connect/token`,
            exacto: true,
          },
        ],
      });
    })().catch((err: unknown) => {
      promesaServidorAppQr = null;
      throw err;
    });
    return promesaServidorAppQr;
  }

  // DOC-028 Fase G (CORE-RF-06) -- el CCP servido también en la IP de LAN, por HTTPS (mismo cert
  // que la APP QR, appqr-tls.ts), para el Profesional de AFT que trabaja desde su propia PC contra
  // esta. Es un servidor aparte del de loopback, que sigue sirviendo el portal embebido de esta
  // PC. La página es HTTPS y CIS/Keycloak van por HTTP: esos fetch serían contenido mixto
  // (Firefox y los Chromium sin Local Network Access los bloquean) y CIS no tiene este origen en
  // su CORS. Por eso este servidor hace de proxy de mismo origen, solo para `/cis/*` y el token
  // endpoint del realm. El login (authorize) es una navegación de página completa y va directo a
  // Keycloak, sin proxy.
  function asegurarServidorCcpLan(): Promise<void> {
    promesaServidorCcpLan ??= (async () => {
      const origen = obtenerOrigenCcpLan();
      const issuer = issuerDelRealm();
      await iniciarServidorEstatico({
        nombre: "ccp-lan",
        distPath: rutaDistDePortal("ccp"),
        puerto: PUERTO_CCP_LAN,
        host: obtenerIpLan(),
        tls: await obtenerCertificadoAppQr(),
        configRuntime: {
          VITE_KEYCLOAK_ISSUER: issuer,
          VITE_KEYCLOAK_CLIENT_ID: CLIENT_ID_CCP,
          VITE_CIS_URL: `${origen}${RUTA_PROXY_CIS}`,
          VITE_KEYCLOAK_TOKEN_URL: `${origen}${RUTA_PROXY_TOKEN}`,
          ...configCcpDeInstalacion(),
        },
        proxies: [
          {
            prefijo: RUTA_PROXY_CIS,
            destino: `http://127.0.0.1:${PUERTO_CIS}`,
          },
          {
            prefijo: RUTA_PROXY_TOKEN,
            destino: `${issuer}/protocol/openid-connect/token`,
            exacto: true,
          },
        ],
      });
    })().catch((err: unknown) => {
      promesaServidorCcpLan = null;
      throw err;
    });
    return promesaServidorCcpLan;
  }

  function asegurarServidoresPortales(): Promise<void> {
    promesaServidoresPortales ??= (async () => {
      // DOC-028 Fase C.0 -- la config OIDC de ccp/core-frontend se resuelve acá, en cada arranque,
      // y se inyecta en el index.html servido (static-portal-server.ts). El issuer lleva la IP de
      // LAN de ESTE arranque (KEYCLOAK_CONFIG.url ya la recalculó); si la IP cambió desde la
      // instalación, el portal igual apunta bien sin recompilar. cisUrl es 127.0.0.1 (loopback).
      const issuer = issuerDelRealm();
      const cisUrl = `http://127.0.0.1:${PUERTO_CIS}`;
      const configCcp = configCcpDeInstalacion();
      await iniciarServidorEstatico({
        nombre: "ccp",
        distPath: rutaDistDePortal("ccp"),
        puerto: PUERTO_CCP,
        configRuntime: {
          VITE_KEYCLOAK_ISSUER: issuer,
          VITE_KEYCLOAK_CLIENT_ID: CLIENT_ID_CCP,
          VITE_CIS_URL: cisUrl,
          ...configCcp,
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
          VITE_SICSAFT_NIVEL: configCcp.VITE_SICSAFT_NIVEL,
        },
      });
      await asegurarServidorAppQr();
      // DOC-028 Fase G -- no se espera ni puede tumbar este arranque: el puesto del AFT en otra PC
      // es secundario, el login del Director en esta PC no depende de él. Si falla (puerto
      // ocupado), queda en el log y getInfoPuestoAft lo reintenta al abrir la pantalla "listo".
      asegurarServidorCcpLan().catch((err: unknown) => {
        console.error(
          "[sicsaft-core] No se pudo servir el CCP en la red local (puesto del Profesional de AFT):",
          err,
        );
      });
    })().catch((err: unknown) => {
      // Si el arranque falló de verdad, no dejar la promesa rechazada cacheada -- permitir que un
      // reintento (otro mostrarPortalEmbebido) lo vuelva a intentar.
      promesaServidoresPortales = null;
      throw err;
    });
    return promesaServidoresPortales;
  }

  // DOC-028 Fase D -- la pantalla "listo" (PasoListoConLogin) muestra un QR con esta URL para que
  // el Profesional de AFT abra la PWA de la APP QR desde el teléfono. De paso arranca el servidor
  // HTTPS de la APP QR si todavía no lo hizo, para que un escaneo inmediato encuentre algo.
  ipcMain.handle("sicsaft-core:getUrlAppQr", async (): Promise<string> => {
    await asegurarServidorAppQr();
    return obtenerOrigenAppQr();
  });

  // DOC-029 RF-H -- información consolidada de acceso para el teléfono: URL de la PWA, URL del APK
  // y disponibilidad del binario APK para descargar.
  ipcMain.handle("sicsaft-core:getInfoAppQr", async (): Promise<InfoAppQr> => {
    await asegurarServidorAppQr();
    const origen = obtenerOrigenAppQr();
    const rutaApk = rutaArchivoApk();
    const apkDisponible = existsSync(rutaApk);
    return {
      urlPwa: origen,
      urlApk: `${origen}/sicsaft-aft.apk`,
      apkDisponible,
    };
  });

  // DOC-028 Fase G -- la pantalla "listo" muestra la dirección del puesto del Profesional de AFT
  // (su propia PC). De paso arranca el servidor del CCP de LAN si todavía no lo hizo (o si falló
  // antes), para que el primer intento desde la otra PC ya encuentre algo. `enRed` = false cuando
  // esta PC no tiene IP de LAN (obtenerIpLan cayó a loopback).
  ipcMain.handle(
    "sicsaft-core:getInfoPuestoAft",
    async (): Promise<InfoPuestoAft> => {
      await asegurarServidorCcpLan();
      return {
        url: obtenerOrigenCcpLan(),
        enRed: !obtenerIpLan().startsWith("127."),
      };
    },
  );

  // DOC-028 Fase G -- guarda un acceso directo de Windows (.url) a esa dirección, para llevarlo a
  // la PC del AFT (pendrive o carpeta compartida). El diálogo nativo decide la ruta, no el
  // renderer. Devuelve la ruta elegida, o null si el usuario canceló.
  ipcMain.handle(
    "sicsaft-core:guardarAccesoDirectoPuestoAft",
    async (): Promise<string | null> => {
      const resultado = await dialog.showSaveDialog(ventana, {
        title: "Guardar el acceso directo para la PC del Profesional de AFT",
        defaultPath: join(app.getPath("desktop"), NOMBRE_ACCESO_DIRECTO),
        filters: [{ name: "Acceso directo de Internet", extensions: ["url"] }],
      });
      if (resultado.canceled || !resultado.filePath) return null;
      await writeFile(
        resultado.filePath,
        contenidoAccesoDirecto(obtenerOrigenCcpLan()),
        "utf-8",
      );
      return resultado.filePath;
    },
  );

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

  return { asegurarServidoresPortales };
}
