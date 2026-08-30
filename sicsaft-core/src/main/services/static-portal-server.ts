import { createServer, type Server, type ServerResponse } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createReadStream, readFile } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { app } from "electron";

// CORE-RF-04 -- sirve el build ya compilado (`npm run build`) de un portal (ccp/core-frontend)
// por http://127.0.0.1:<puerto> dentro del propio proceso de Electron. Sin dependencia nueva
// (nada de `express`/`serve-static`) -- mismo criterio que node-backend-service.ts (cis/core/cip
// corren "node dist/main.js" directo, sin su propio toolchain de desarrollo en runtime): un
// servidor estático mínimo con `node:http` alcanza para archivos ya generados, no hace falta el
// dev-server de Vite (que además arrastraría vite + sus plugins como dependencia de producción,
// mucho más pesado que esto).
//
// Contexto seguro: 127.0.0.1 SÍ es "secure context" para la Web Platform (a diferencia de
// `file://`, ver ARCHITECTURE.md "Los portales embebidos") -- crypto.subtle/PKCE funcionan igual
// que en cualquier navegador real, sin el workaround de certificado autofirmado. La APP QR
// (DOC-028 Fase D) es la excepción: el teléfono la alcanza por la IP de LAN, nunca "localhost",
// así que necesita HTTPS de verdad (cert autofirmado, `tls`) -- el mismo servidor con
// `https.createServer` en vez de `http.createServer`, escuchando en la IP de LAN (`host`).
const TIPOS_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

export interface ConfigPortalEstatico {
  nombre: string;
  distPath: string;
  puerto: number;
  // Interfaz donde escucha. Default 127.0.0.1 (portales de escritorio, loopback). La APP QR
  // (DOC-028 Fase D) escucha en la IP de LAN para que el teléfono la alcance -- nunca 0.0.0.0.
  host?: string;
  // Presente -> se sirve por HTTPS con este cert autofirmado (APP QR, ver el comentario del
  // encabezado). Ausente -> HTTP plano (loopback = secure context de todos modos).
  tls?: { key: string; cert: string };
  // DOC-028 Fase C.0 -- config OIDC (issuer/clientId/cisUrl) que el portal NO puede hornear en su
  // build de Vite: la IP de LAN de Keycloak recién se conoce en cada arranque del .exe, y tiene
  // que poder cambiar sin recompilar el portal (Fase C.1). Se inyecta como
  // `window.__SICSAFT_PORTAL_CONFIG__` en el index.html; ccp/core-frontend/app-qr lo leen antes de
  // caer a import.meta.env (ver sus oidc-config.ts). Claves con el mismo nombre que las env
  // vars VITE_*.
  configRuntime?: Record<string, string>;
}

// DOC-028 Fase C.0 -- mete un <script> con la config runtime justo después de <head>, para que
// corra antes que el bundle del portal (que lee window.__SICSAFT_PORTAL_CONFIG__ al inicializarse).
// Cada "<" del JSON se reemplaza por su escape unicode: los valores son URLs que arma el proceso
// principal (no entrada de usuario), pero así igual ningún valor puede cerrar el </script> ni
// abrir un comentario HTML. Si no hay <head> (index.html no estándar), se antepone al documento.
export function inyectarConfigRuntime(
  html: string,
  configRuntime: Record<string, string>,
): string {
  const json = JSON.stringify(configRuntime).replace(/</g, "\\u003c");
  const script = `<script>window.__SICSAFT_PORTAL_CONFIG__=${json};</script>`;
  return html.includes("<head>")
    ? html.replace("<head>", `<head>${script}`)
    : script + html;
}

// Resuelve la ruta del request a un archivo GARANTIZADO dentro de `raizDist`, o a null si se sale
// (path traversal, ruta absoluta, %-encoding inválido, byte nulo). Nunca toca el filesystem con
// un valor no confiable -- la contención se decide solo con aritmética de rutas (`path.relative`,
// idioma que el analisis de taint reconoce como sanitizador para S2083/S6549). El "existe / es un
// archivo" lo resuelve despues el propio `createReadStream` via su evento `error`, sin un
// `existsSync`/`statSync` sobre datos del request.
function resolverArchivoDentroDe(
  raizDist: string,
  urlCruda: string,
): string | null {
  let rutaRelativa: string;
  try {
    rutaRelativa = decodeURIComponent(urlCruda.split("?")[0]);
  } catch {
    return null; // %-encoding malformado
  }
  if (rutaRelativa.includes("\0")) return null;

  const candidato = resolve(raizDist, "." + rutaRelativa);
  const rel = relative(raizDist, candidato);
  const dentro = rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  return dentro ? candidato : null;
}

// SPA fallback: cualquier ruta que no matchee un archivo real (ej. "/auth/callback", que el
// router de React resuelve del lado del cliente) sirve index.html -- mismo comportamiento que
// `vite preview`/cualquier hosting de SPA (Vercel, Netlify), sin el cual un refresh en
// "/auth/callback" tiraría 404 en vez de dejar que React Router (o el equivalente casero de cada
// portal) lo maneje. Un intento de path traversal cae por el mismo camino que una ruta
// inexistente -- index.html, nunca un archivo de afuera del dist.
export function iniciarServidorEstatico(
  config: ConfigPortalEstatico,
): Promise<Server> {
  const raizDist = resolve(config.distPath);
  const indexHtml = join(raizDist, "index.html");

  // index.html se lee entero y se transforma (DOC-028 Fase C.0 -- inyecta la config OIDC runtime),
  // no se streamea como el resto de los assets. Se usa tanto en el match directo de "/" como en el
  // SPA fallback.
  function servirIndex(res: ServerResponse): void {
    readFile(indexHtml, "utf-8", (err, html) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (err) {
        res.statusCode = 500;
        res.end("index.html no encontrado en el build del portal");
        return;
      }
      res.setHeader("Content-Type", TIPOS_MIME[".html"]);
      res.end(
        config.configRuntime
          ? inyectarConfigRuntime(html, config.configRuntime)
          : html,
      );
    });
  }

  function manejar(req: { url?: string }, res: ServerResponse): void {
    const archivo =
      resolverArchivoDentroDe(raizDist, req.url ?? "/") ?? indexHtml;

    if (archivo === indexHtml) {
      servirIndex(res);
      return;
    }

    res.setHeader(
      "Content-Type",
      TIPOS_MIME[extname(archivo)] ?? "application/octet-stream",
    );

    const stream = createReadStream(archivo);
    stream.on("error", () => {
      // El error casi siempre llega antes del primer chunk (ENOENT/EISDIR) -- si ya se empezó
      // a enviar el body no hay nada que hacer, solo cortar.
      if (res.headersSent) {
        res.destroy();
        return;
      }
      // Ruta contenida pero sin archivo real (o es un directorio) -> SPA fallback a index.html.
      servirIndex(res);
    });
    stream.pipe(res);
  }

  return new Promise((listo, fallo) => {
    const servidor = config.tls
      ? createHttpsServer(
          { key: config.tls.key, cert: config.tls.cert },
          manejar,
        )
      : createServer(manejar);

    servidor.once("error", fallo);
    servidor.listen(config.puerto, config.host ?? "127.0.0.1", () => {
      servidor.removeListener("error", fallo);
      listo(servidor);
    });
  });
}

// Mismo criterio que rutaDistDeSistema() de node-backend-service.ts -- dev: hermano en la raíz
// del monorepo; producción: copiado a resources/<portal>/dist por electron-builder (extraResources,
// ver package.json "build"). "app-qr-sicsaft" se sumó en DOC-028 Fase D (el .exe también sirve la
// PWA de la APP QR).
export function rutaDistDePortal(
  portal: "ccp" | "core-frontend" | "app-qr-sicsaft",
): string {
  const carpeta = portal === "core-frontend" ? "core/frontend" : portal;
  if (app.isPackaged) {
    return join(process.resourcesPath, portal, "dist");
  }
  return join(__dirname, "..", "..", "..", carpeta, "dist");
}
