import { createServer, type Server } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { app } from "electron";

// CORE-RF-04 -- sirve el build ya compilado (`npm run build`) de un portal (ccp/core-frontend)
// por http://127.0.0.1:<puerto> dentro del propio proceso de Electron. Sin dependencia nueva
// (nada de `express`/`serve-static`) -- mismo criterio que node-backend-service.ts (cis/core/cip
// corren "node dist/main.js" directo, sin su propio toolchain de desarrollo en runtime): un
// servidor estático de ~40 líneas con `node:http` alcanza para archivos ya generados, no hace
// falta el dev-server de Vite (que además arrastraría vite + sus plugins como dependencia de
// producción, mucho más pesado que esto).
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

// SPA fallback: cualquier ruta que no matchee un archivo real (ej. "/auth/callback", que el
// router de React resuelve del lado del cliente) sirve index.html -- mismo comportamiento que
// `vite preview`/cualquier hosting de SPA (Vercel, Netlify), sin el cual un refresh en
// "/auth/callback" tiraría 404 en vez de dejar que React Router (o el equivalente casero de cada
// portal) lo maneje.
export function iniciarServidorEstatico(
  config: ConfigPortalEstatico,
): Promise<Server> {
  return new Promise((resolve, reject) => {
    const servidor = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const rutaSolicitada = join(config.distPath, urlPath);
      const rutaSegura = rutaSolicitada.startsWith(config.distPath)
        ? rutaSolicitada
        : config.distPath; // evita path traversal (../../..) -- cae al dist raíz, nunca afuera

      const rutaArchivo =
        existsSync(rutaSegura) && statSync(rutaSegura).isFile()
          ? rutaSegura
          : join(config.distPath, "index.html");

      res.setHeader(
        "Content-Type",
        TIPOS_MIME[extname(rutaArchivo)] ?? "application/octet-stream",
      );
      createReadStream(rutaArchivo).pipe(res);
    });

    servidor.once("error", reject);
    servidor.listen(config.puerto, "127.0.0.1", () => {
      servidor.removeListener("error", reject);
      resolve(servidor);
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
