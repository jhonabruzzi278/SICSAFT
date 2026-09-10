import { request } from "@playwright/test";
import { test, expect, loginPorNavegador } from "../fixtures/portales";
import { capturar } from "../fixtures/capturas";
import { PUERTOS } from "../test-data";

// DOC-028 Fase G (CORE-RF-06) -- el Profesional de AFT trabaja desde SU PROPIA PC contra la PC
// madre: el `.exe` sirve el CCP también en https://<ip-lan>:8767, con un proxy de mismo origen
// hacia CIS (/cis) y el token endpoint de Keycloak (/kc/token). Acá "la otra PC" es un Chromium
// aparte que entra por la IP de LAN -- nunca por 127.0.0.1 --, igual que el navegador del puesto.

test.describe("20 - Puesto del Profesional de AFT en otra PC (CCP por la LAN)", () => {
  test("getInfoPuestoAft devuelve la URL HTTPS de LAN y ese servidor sirve el CCP con la config del proxy", async ({
    exe,
  }) => {
    const info = await exe.page.evaluate(() =>
      window.sicsaftCore.getInfoPuestoAft(),
    );
    expect(info.url).toMatch(
      new RegExp(`^https://\\d+\\.\\d+\\.\\d+\\.\\d+:${PUERTOS.ccpLan}$`),
    );

    // Cert autofirmado -> contexto que ignora el error de TLS (el AFT lo acepta una vez).
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    try {
      const index = await ctx.get(`${info.url}/`, { timeout: 20_000 });
      expect(index.status()).toBe(200);
      const html = await index.text();
      expect(html).toContain(`"VITE_CIS_URL":"${info.url}/cis"`);
      expect(html).toContain(
        `"VITE_KEYCLOAK_TOKEN_URL":"${info.url}/kc/token"`,
      );

      // El proxy llega a CIS de la PC madre.
      const health = await ctx.get(`${info.url}/cis/health`, {
        timeout: 20_000,
      });
      expect(health.status()).toBe(200);
    } finally {
      await ctx.dispose();
    }
  });

  test("el AFT inicia sesión desde el navegador de otra PC y el CCP lee la BPI por el proxy, sin contenido mixto", async ({
    exe,
    browser,
  }, testInfo) => {
    const { url } = await exe.page.evaluate(() =>
      window.sicsaftCore.getInfoPuestoAft(),
    );
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    const estadosCis: number[] = [];
    const directosACis: string[] = [];
    const bloqueados: string[] = [];
    page.on("response", (r) => {
      if (r.url().startsWith(`${url}/cis/`)) estadosCis.push(r.status());
    });
    page.on("request", (r) => {
      if (r.url().includes(`:${PUERTOS.cis}/`)) directosACis.push(r.url());
    });
    page.on("console", (m) => {
      if (/mixed content/i.test(m.text())) bloqueados.push(m.text());
    });

    try {
      const token = await loginPorNavegador(page, "aft", url);
      expect(token.split(".")).toHaveLength(3);

      // Después del login el CCP pide datos de la BPI -> tienen que pasar por el proxy.
      await expect
        .poll(() => estadosCis.filter((s) => s === 200).length, {
          timeout: 30_000,
        })
        .toBeGreaterThan(0);
      expect(
        estadosCis.filter((s) => s >= 500),
        `respuestas /cis: ${estadosCis.join(",")}`,
      ).toEqual([]);
      // Nada va directo a CIS por HTTP y el navegador no bloqueó nada por contenido mixto.
      expect(directosACis).toEqual([]);
      expect(bloqueados).toEqual([]);

      await capturar(page, testInfo, "puesto-aft-ccp-por-lan");
    } finally {
      await context.close();
    }
  });
});
