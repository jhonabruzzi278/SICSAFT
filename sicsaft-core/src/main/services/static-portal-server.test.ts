import { describe, expect, test, vi, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
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
} from "./static-portal-server";

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

describe("iniciarServidorEstatico", () => {
  let dist = "";
  let servidor: { close: (cb?: () => void) => void } | null = null;

  afterEach(() => {
    servidor?.close();
    servidor = null;
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
});
