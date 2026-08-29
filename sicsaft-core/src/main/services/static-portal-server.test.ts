import { describe, expect, test, vi } from "vitest";

// static-portal-server.ts importa `app` de Electron (rutaDistDePortal) -- no se ejercita acá,
// solo se testea inyectarConfigRuntime, que es una función pura de string.
vi.mock("electron", () => ({ app: { isPackaged: false } }));

import { inyectarConfigRuntime } from "./static-portal-server";

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
