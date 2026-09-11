import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { createReadStream, existsSync, readFile } from "node:fs";
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
  ".apk": "application/vnd.android.package-archive",
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
  // DOC-028 Fase G -- rutas que no se sirven del dist sino que se reenvían a un backend de esta
  // misma PC (proxy de mismo origen). Solo lo usa el CCP servido en la LAN por HTTPS. Un fetch de
  // esa página a CIS/Keycloak por HTTP es contenido mixto (Firefox y los Chromium sin Local Network
  // Access lo bloquean) y CIS no tiene ese origen en su CORS; por eso CIS y el token endpoint se
  // exponen bajo el origen del propio portal. Ausente -> no se reenvía nada.
  proxies?: readonly ProxyPortal[];
}

// Una ruta del portal que se reenvía (DOC-028 Fase G). `destino` es fijo, lo arma el proceso
// principal al configurar el servidor -- nunca sale del request, así que esto no es un proxy
// abierto: el request solo aporta la parte de la ruta que cuelga del prefijo y el query.
export interface ProxyPortal {
  // Ruta pública sin barra final (ej. "/cis"). Matchea esa ruta y lo que cuelga de ella
  // ("/cis/activos"), nunca un prefijo parcial ("/cisx").
  prefijo: string;
  // URL http absoluta. Lo que sigue al prefijo se agrega al final de su path.
  destino: string;
  // true -> solo la ruta exacta (ej. el token endpoint: no se reenvía "token/introspect").
  exacto?: boolean;
}

// Base ficticia para interpretar la ruta del request -- solo se usan su pathname y su query,
// nunca se abre una conexión a este host (TLD .invalid reservado, RFC 2606). https para no
// disparar el falso positivo de "protocolo inseguro" del analizador estático.
const BASE_RUTA_REQUEST = "https://portal.invalid";

// Devuelve la URL de destino si la ruta cae en algún proxy, o null. La ruta se normaliza con
// `new URL` ANTES de comparar ("..", "%2e%2e") y lo que se reenvía es esa misma ruta ya
// normalizada: el chequeo y el reenvío miran el mismo valor, así "/cis/../admin" no pasa el filtro
// con una forma y llega al destino con otra. El path se asigna con el setter de `pathname` (no
// armando un string que se vuelve a parsear): una ruta como "/cis//otro-host/x" no puede cambiar
// el host del destino.
export function resolverDestinoProxy(
  proxies: readonly ProxyPortal[],
  urlCruda: string,
): URL | null {
  let ruta: URL;
  try {
    ruta = new URL(urlCruda, BASE_RUTA_REQUEST);
  } catch {
    return null;
  }
  const { pathname } = ruta;
  for (const proxy of proxies) {
    const esExacta = pathname === proxy.prefijo;
    const cuelga = !proxy.exacto && pathname.startsWith(`${proxy.prefijo}/`);
    if (!esExacta && !cuelga) continue;
    const destino = new URL(proxy.destino);
    // El host/puerto salen del literal `proxy.destino`, nunca de `urlCruda` -- reasignar
    // pathname/search no puede cambiarlos. Se guarda el origin fijo ANTES de tocar la ruta y se
    // reverifica después: cinturón y tirantes, y patrón que el taint engine (Sonar S5144/SSRF)
    // reconoce como saneador -- una comparación literal del destino contra un origen conocido.
    const origenFijo = destino.origin;
    const basePath = destino.pathname.replace(/\/$/, "");
    destino.pathname = `${basePath}${pathname.slice(proxy.prefijo.length)}`;
    destino.search = ruta.search;
    if (destino.origin !== origenFijo) return null;
    return destino;
  }
  return null;
}

// Cabeceras hop-by-hop (RFC 9110 §7.6.1): describen la conexión de ESTE salto, no el mensaje -- un
// proxy no las reenvía. `host` también sale: node:http pone el del destino (Keycloak valida el
// Host contra KC_HOSTNAME, ver keycloak-service.ts).
const CABECERAS_NO_REENVIABLES = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function cabecerasReenviables(
  cabeceras: IncomingHttpHeaders,
): OutgoingHttpHeaders {
  return Object.fromEntries(
    Object.entries(cabeceras).filter(
      ([nombre, valor]) =>
        valor !== undefined &&
        !CABECERAS_NO_REENVIABLES.has(nombre.toLowerCase()),
    ),
  );
}

// Un import de Excel grande pasa por acá (CCP -> /cis) y CORE puede tardar; es tope de inactividad
// del socket, no de duración total.
const TIMEOUT_PROXY_MS = 120_000;

function reenviar(
  req: IncomingMessage,
  res: ServerResponse,
  destino: URL,
): void {
  const peticion = httpRequest(
    destino,
    {
      method: req.method,
      headers: cabecerasReenviables(req.headers),
      timeout: TIMEOUT_PROXY_MS,
    },
    (respuesta) => {
      res.writeHead(
        respuesta.statusCode ?? 502,
        cabecerasReenviables(respuesta.headers),
      );
      respuesta.pipe(res);
    },
  );
  peticion.on("timeout", () => {
    peticion.destroy(new Error("timeout del proxy"));
  });
  peticion.on("error", () => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("La PC madre no respondió a este pedido (servicio no disponible).");
  });
  // Si el navegador corta (cerró la pestaña), no dejar el pedido al backend colgado.
  res.on("close", () => {
    if (!res.writableFinished) peticion.destroy();
  });
  req.pipe(peticion);
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

  function manejar(req: IncomingMessage, res: ServerResponse): void {
    const destinoProxy = config.proxies
      ? resolverDestinoProxy(config.proxies, req.url ?? "/")
      : null;
    if (destinoProxy) {
      reenviar(req, res, destinoProxy);
      return;
    }

    if (
      req.url === "/sicsaft-aft.apk" ||
      req.url?.startsWith("/sicsaft-aft.apk?")
    ) {
      const rutaApk = rutaArchivoApk();
      if (existsSync(rutaApk)) {
        res.setHeader("Content-Type", TIPOS_MIME[".apk"]);
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="sicsaft-aft.apk"',
        );
        const streamApk = createReadStream(rutaApk);
        streamApk.pipe(res);
        return;
      }
    }

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

// DOC-029 RF-H -- ruta del binario APK Android firmado. En producción: resources/apk/sicsaft-aft.apk
// (copiado por prepack.cjs/extraResources). En dev: busca en resources/apk/ o en el build de apk-aft/.
export function rutaArchivoApk(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "apk", "sicsaft-aft.apk");
  }
  const recursoDev = join(
    __dirname,
    "..",
    "..",
    "resources",
    "apk",
    "sicsaft-aft.apk",
  );
  if (existsSync(recursoDev)) return recursoDev;
  return join(
    __dirname,
    "..",
    "..",
    "..",
    "apk-aft",
    "app",
    "build",
    "outputs",
    "apk",
    "release",
    "app-release.apk",
  );
}
