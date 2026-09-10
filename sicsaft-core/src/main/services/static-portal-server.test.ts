import { describe, expect, test, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import selfsigned from "selfsigned";

// GET https con cert autofirmado (rejectUnauthorized: false) -- undici/fetch de Node no acepta
// un agent para esto sin más vueltas; node:https directo es lo más simple para el test.
function getInseguro(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, { rejectUnauthorized: false }, (res) => {
      let body = "";
      res.setEncoding("utf-8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
  });
}

vi.mock("electron", () => ({ app: { isPackaged: false } }));

import {
  inyectarConfigRuntime,
  iniciarServidorEstatico,
  resolverDestinoProxy,
} from "./static-portal-server";

// Backend de prueba que devuelve en JSON lo que recibió -- para ver qué reenvió el proxy.
function arrancarBackendEco(): Promise<{ servidor: Server; puerto: number }> {
  return new Promise((resolve) => {
    const servidor = createServer((req, res) => {
      let body = "";
      req.setEncoding("utf-8");
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("X-Eco", "1");
        res.end(
          JSON.stringify({
            method: req.method,
            url: req.url,
            host: req.headers.host,
            auth: req.headers.authorization ?? null,
            body,
          }),
        );
      });
    });
    servidor.listen(0, "127.0.0.1", () => {
      resolve({ servidor, puerto: (servidor.address() as AddressInfo).port });
    });
  });
}

const CONFIG = {
  VITE_KEYCLOAK_ISSUER: "http://192.168.1.11:58080/realms/sicsaft",
  VITE_KEYCLOAK_CLIENT_ID: "ccp",
  VITE_CIS_URL: "http://127.0.0.1:56000",
};

describe("inyectarConfigRuntime", () => {
  test("mete el <script> justo después de <head>, antes del bundle del portal", () => {
    const html =
      '<!doctype html><html><head><script type="module" src="/assets/index.js"></script></head><body></body></html>';

    const salida = inyectarConfigRuntime(html, CONFIG);

    expect(salida).toContain("<head><script>window.__SICSAFT_PORTAL_CONFIG__=");
    // El script inyectado va antes del <script type="module"> del bundle.
    expect(salida.indexOf("__SICSAFT_PORTAL_CONFIG__")).toBeLessThan(
      salida.indexOf('type="module"'),
    );
  });

  test("el JSON inyectado es parseable y trae las 3 claves", () => {
    const salida = inyectarConfigRuntime("<head></head>", CONFIG);
    const json = salida.slice(
      salida.indexOf("=") + 1,
      salida.indexOf(";</script>"),
    );
    expect(JSON.parse(json)).toEqual(CONFIG);
  });

  test("escapa '<' para que un valor no pueda cerrar el <script> ni abrir un comentario HTML", () => {
    const salida = inyectarConfigRuntime("<head></head>", {
      ...CONFIG,
      VITE_CIS_URL: "http://x/</script><!--",
    });
    // No aparece un </script> literal dentro del bloque inyectado.
    const bloque = salida.slice(0, salida.indexOf("</script>") + 9);
    expect(bloque).not.toContain("</script><!--");
    expect(bloque).toContain("\\u003c/script>\\u003c!--");
  });

  test("sin <head> (index.html no estándar) antepone el script al documento", () => {
    const salida = inyectarConfigRuntime("<body>hola</body>", CONFIG);
    expect(salida.startsWith("<script>window.__SICSAFT_PORTAL_CONFIG__=")).toBe(
      true,
    );
    expect(salida).toContain("<body>hola</body>");
  });
});

describe("resolverDestinoProxy (DOC-028 Fase G)", () => {
  const PROXIES = [
    { prefijo: "/cis", destino: "http://127.0.0.1:56000" },
    {
      prefijo: "/kc/token",
      destino:
        "http://192.168.1.11:58080/realms/sicsaft/protocol/openid-connect/token",
      exacto: true,
    },
  ];

  test("reenvía lo que cuelga del prefijo, con el query, al destino fijo", () => {
    expect(
      resolverDestinoProxy(PROXIES, "/cis/activos?organizacionId=org-1")?.href,
    ).toBe("http://127.0.0.1:56000/activos?organizacionId=org-1");
  });

  test("una ruta exacta se reenvía a la URL completa del destino", () => {
    expect(resolverDestinoProxy(PROXIES, "/kc/token")?.href).toBe(
      "http://192.168.1.11:58080/realms/sicsaft/protocol/openid-connect/token",
    );
  });

  test("exacto: no reenvía lo que cuelga de la ruta (ej. token/introspect)", () => {
    expect(resolverDestinoProxy(PROXIES, "/kc/token/introspect")).toBeNull();
  });

  test("no matchea un prefijo parcial ni las rutas propias del portal", () => {
    expect(resolverDestinoProxy(PROXIES, "/cisx")).toBeNull();
    expect(resolverDestinoProxy(PROXIES, "/catalogo")).toBeNull();
    expect(resolverDestinoProxy(PROXIES, "/kc/admin")).toBeNull();
    expect(resolverDestinoProxy(PROXIES, "/")).toBeNull();
  });

  test.each(["/cis/../kc/admin", "/cis/%2e%2e/admin", "/cis/%2E%2E/kc/admin"])(
    "normaliza antes de comparar: %s no se reenvía",
    (ruta) => {
      expect(resolverDestinoProxy(PROXIES, ruta)).toBeNull();
    },
  );

  test("una ruta con // no puede cambiar el host de destino", () => {
    expect(resolverDestinoProxy(PROXIES, "/cis//evil.example/x")?.host).toBe(
      "127.0.0.1:56000",
    );
  });

  test("un request en absolute-form (http://otro-host/cis/...) igual va al destino fijo", () => {
    expect(
      resolverDestinoProxy(PROXIES, "http://evil.example/cis/x")?.host,
    ).toBe("127.0.0.1:56000");
  });
});

describe("iniciarServidorEstatico", () => {
  let dist = "";
  let servidor: { close: (cb?: () => void) => void } | null = null;
  let backend: Server | null = null;

  afterEach(() => {
    servidor?.close();
    servidor = null;
    backend?.close();
    backend = null;
    if (dist) rmSync(dist, { recursive: true, force: true });
    dist = "";
  });

  function crearDist(): string {
    dist = mkdtempSync(join(tmpdir(), "sicsaft-portal-"));
    writeFileSync(
      join(dist, "index.html"),
      '<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>',
    );
    writeFileSync(join(dist, "app.js"), "console.log(1)");
    return dist;
  }

  test("HTTP: sirve index.html con la config runtime inyectada, y assets tal cual", async () => {
    const distPath = crearDist();
    servidor = await iniciarServidorEstatico({
      nombre: "t-http",
      distPath,
      puerto: 8793,
      configRuntime: CONFIG,
    });

    const idx = await (await fetch("http://127.0.0.1:8793/")).text();
    expect(idx).toContain("window.__SICSAFT_PORTAL_CONFIG__=");
    expect(idx).toContain('"VITE_KEYCLOAK_CLIENT_ID":"ccp"');

    const asset = await fetch("http://127.0.0.1:8793/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("console.log(1)");
    // el asset NO lleva el <script> inyectado
    expect(
      await (await fetch("http://127.0.0.1:8793/app.js")).text(),
    ).not.toContain("__SICSAFT_PORTAL_CONFIG__");

    // SPA fallback también inyecta
    const cb = await (await fetch("http://127.0.0.1:8793/scan")).text();
    expect(cb).toContain("window.__SICSAFT_PORTAL_CONFIG__=");
  });

  test("HTTPS (DOC-028 Fase D): sirve por TLS en el host indicado con el cert dado", async () => {
    const distPath = crearDist();
    const pems = await selfsigned.generate(
      [{ name: "commonName", value: "127.0.0.1" }],
      {
        keySize: 2048,
        algorithm: "sha256",
        extensions: [
          {
            name: "subjectAltName",
            altNames: [{ type: 7, ip: "127.0.0.1" }],
          },
        ],
      },
    );
    servidor = await iniciarServidorEstatico({
      nombre: "t-https",
      distPath,
      puerto: 8794,
      host: "127.0.0.1",
      tls: { key: pems.private, cert: pems.cert },
      configRuntime: CONFIG,
    });

    const res = await getInseguro("https://127.0.0.1:8794/");
    expect(res.status).toBe(200);
    expect(res.body).toContain("window.__SICSAFT_PORTAL_CONFIG__=");
  });

  test("proxies (DOC-028 Fase G): reenvía /cis/* y el token endpoint con método, body, Authorization y el Host del destino", async () => {
    const eco = await arrancarBackendEco();
    backend = eco.servidor;
    servidor = await iniciarServidorEstatico({
      nombre: "t-proxy",
      distPath: crearDist(),
      puerto: 8795,
      configRuntime: CONFIG,
      proxies: [
        { prefijo: "/cis", destino: `http://127.0.0.1:${eco.puerto}` },
        {
          prefijo: "/kc/token",
          destino: `http://127.0.0.1:${eco.puerto}/realms/sicsaft/protocol/openid-connect/token`,
          exacto: true,
        },
      ],
    });

    const cis = await fetch(
      "http://127.0.0.1:8795/cis/activos?organizacionId=org-1",
      { headers: { Authorization: "Bearer abc" } },
    );
    expect(cis.status).toBe(200);
    // las cabeceras de la respuesta del backend llegan al navegador
    expect(cis.headers.get("x-eco")).toBe("1");
    expect(await cis.json()).toMatchObject({
      method: "GET",
      url: "/activos?organizacionId=org-1",
      host: `127.0.0.1:${eco.puerto}`,
      auth: "Bearer abc",
    });

    const token = await fetch("http://127.0.0.1:8795/kc/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=xyz",
    });
    expect(await token.json()).toMatchObject({
      method: "POST",
      url: "/realms/sicsaft/protocol/openid-connect/token",
      body: "grant_type=authorization_code&code=xyz",
    });

    // lo que no es proxy sigue siendo el portal (SPA fallback con la config inyectada)
    const idx = await (await fetch("http://127.0.0.1:8795/catalogo")).text();
    expect(idx).toContain("window.__SICSAFT_PORTAL_CONFIG__=");
  });

  test("proxies: responde 502 si el backend de destino no está escuchando", async () => {
    const eco = await arrancarBackendEco();
    const puertoMuerto = eco.puerto;
    await new Promise<void>((r) => eco.servidor.close(() => r()));
    servidor = await iniciarServidorEstatico({
      nombre: "t-proxy-502",
      distPath: crearDist(),
      puerto: 8796,
      proxies: [
        { prefijo: "/cis", destino: `http://127.0.0.1:${puertoMuerto}` },
      ],
    });

    const res = await fetch("http://127.0.0.1:8796/cis/health");
    expect(res.status).toBe(502);
  });
});
