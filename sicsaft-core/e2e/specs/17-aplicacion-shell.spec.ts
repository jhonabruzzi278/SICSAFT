import { request } from "@playwright/test";
import { test, expect } from "../fixtures/portales";
import { capturar } from "../fixtures/capturas";

// "La aplicación" en sí -- el shell Electron, no los portales: el log unificado que ve la Consola
// técnica (CORE-RNF-02, diagnóstico sin terminal), el QR de emparejamiento de la APP QR
// (DOC-028 Fase D) con su servidor HTTPS, y el contrato de getEstadoIpLan (DOC-028 Fase C.1) en
// la instancia viva.

test.describe("17 - Aplicación (shell Electron)", () => {
  test("el log unificado del proceso principal está poblado (Consola técnica / soporte)", async ({
    exe,
  }) => {
    const lineas = await exe.page.evaluate(() =>
      window.sicsaftCore.obtenerLog(),
    );
    expect(Array.isArray(lineas)).toBe(true);
    expect(lineas.length).toBeGreaterThan(0);
    // El arranque completo quedó registrado (uno de estos marcadores siempre aparece).
    expect(lineas.join("\n")).toMatch(
      /proceso principal listo|postgres|keycloak|orquestador/i,
    );
  });

  test("getUrlAppQr devuelve la URL HTTPS de la PWA y su servidor responde", async ({
    exe,
  }) => {
    const url = await exe.page.evaluate(() => window.sicsaftCore.getUrlAppQr());
    expect(url).toMatch(/^https:\/\/\d+\.\d+\.\d+\.\d+:8765$/);

    // Servidor HTTPS con cert autofirmado -> contexto que ignora el error de TLS.
    const ctx = await request.newContext({ ignoreHTTPSErrors: true });
    try {
      const r = await ctx.get(`${url}/`, { timeout: 20_000 });
      expect(r.status(), `${url}/ → ${r.status()}`).toBeLessThan(500);
    } finally {
      await ctx.dispose();
    }
  });

  test("getEstadoIpLan: contrato DOC-028 C.1 bien formado en la instancia viva", async ({
    exe,
  }) => {
    const ip = await exe.page.evaluate(() =>
      window.sicsaftCore.getEstadoIpLan(),
    );
    expect(typeof ip.cambio).toBe("boolean");
    expect(ip.ipActual).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });

  test("la Consola técnica se puede abrir y muestra líneas de log (best-effort UI)", async ({
    exe,
  }, testInfo) => {
    const boton = exe.page.getByRole("button", { name: /detalle técnico/i });
    const visible = await boton
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    test.skip(
      !visible,
      "la Consola técnica no está en pantalla (el portal ocupa la ventana) -- el log ya se verificó por IPC",
    );

    await boton.click();
    await expect(
      exe.page.getByRole("button", { name: /copiar todo/i }),
    ).toBeVisible();
    await expect(
      exe.page.getByRole("button", { name: /abrir carpeta de logs/i }),
    ).toBeVisible();
    await expect(exe.page.locator("pre")).not.toHaveText(
      /^Sin actividad todavía…$/,
    );
    await capturar(exe.page, testInfo, "shell-consola-tecnica");
  });
});
