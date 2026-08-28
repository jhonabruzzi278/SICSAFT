import { createServer, type Server } from "node:http";
import { createReadStream } from "node:fs";
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
// que en cualquier navegador real, sin el workaround de certificado autofirmado que sí hizo
// falta para la APP QR (esa necesitaba alcanzar el teléfono por LAN, acá todo es loopback).
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

  return new Promise((listo, fallo) => {
    const servidor = createServer((req, res) => {
      const archivo =
        resolverArchivoDentroDe(raizDist, req.url ?? "/") ?? indexHtml;

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
        if (archivo === indexHtml) {
          res.statusCode = 500;
          res.end("index.html no encontrado en el build del portal");
          return;
        }
        // Ruta contenida pero sin archivo real (o es un directorio) -> SPA fallback.
        res.setHeader("Content-Type", TIPOS_MIME[".html"]);
        createReadStream(indexHtml).pipe(res);
      });
      stream.pipe(res);
    });

    servidor.once("error", fallo);
    servidor.listen(config.puerto, "127.0.0.1", () => {
      servidor.removeListener("error", fallo);
      listo(servidor);
    });
  });
}

// Mismo criterio que rutaDistDeSistema() de node-backend-service.ts -- dev: hermano en la raíz
// del monorepo; producción: copiado a resources/<portal>/dist por electron-builder
// (extraResources, pendiente agregar junto a cis/core/cip -- ver package.json "build").
export function rutaDistDePortal(portal: "ccp" | "core-frontend"): string {
  const carpeta = portal === "core-frontend" ? "core/frontend" : "ccp";
  if (app.isPackaged) {
    return join(process.resourcesPath, portal, "dist");
  }
  return join(__dirname, "..", "..", "..", carpeta, "dist");
}
