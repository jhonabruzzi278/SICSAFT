import { test, expect, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { resolverExe, esperarServiciosListos } from "../fixtures/electron";
import { ORG } from "../test-data";

// Relanzamiento: con la instalación ya hecha (instalacion.json presente), el `.exe` NO vuelve a
// mostrar el wizard -- salta directo al login. Si la IP de LAN cambió desde la instalación,
// muestra primero la pantalla de reconfiguración de 1 clic (DOC-028 C.1).
//
// Corre SIN la fixture `exe` (usa su propia instancia): la fixture worker mantiene viva la
// instancia de las specs 01-11, y una segunda invocación no arrancaría por el single-instance
// lock. Este archivo (12) y el 13 gestionan su propio `.exe`; la fixture worker cierra su
// instancia y restaura %APPDATA% al final de la corrida.

test.describe.configure({ mode: "serial" });

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  const { exe } = resolverExe();
  app = await electron.launch({
    executablePath: exe,
    args: [],
    timeout: 60_000,
  });
  page = await app.firstWindow({ timeout: 60_000 });
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app?.close().catch(() => undefined);
});

test.describe("12 - Relanzamiento (wizard salteado)", () => {
  test("no aparece el wizard: `getInstalacionExistente` devuelve la organización", async () => {
    const inst = await page.evaluate(() =>
      window.sicsaftCore.getInstalacionExistente(),
    );
    expect(inst?.organizacionId).toBe(ORG.id);
    expect(inst?.clienteNombre).toBe(ORG.nombre);
    expect(inst?.nivel).toBe(ORG.nivel);

    // El renderer no está en el paso 1 del wizard.
    await expect(
      page.getByRole("heading", { name: "Datos de esta instalación" }),
    ).toHaveCount(0);
  });

  test("los servicios vuelven a quedar 'listo' contra los datos existentes", async () => {
    await esperarServiciosListos(page, { incluirCis: true });
    const estado = await page.evaluate(() =>
      window.sicsaftCore.getEstadoServicios(),
    );
    for (const s of ["postgres", "keycloak", "core", "cip"] as const) {
      expect(estado[s]?.estado).toBe("listo");
    }
  });

  test("`getEstadoIpLan` expone si la IP de LAN cambió (flujo de reconfiguración)", async () => {
    const ip = await page.evaluate(() => window.sicsaftCore.getEstadoIpLan());
    // Contrato: siempre trae ipActual; `cambio` es boolean. En esta PC lo normal es que la IP no
    // haya cambiado entre specs (cambio=false), pero el campo tiene que estar bien formado.
    expect(typeof ip.cambio).toBe("boolean");
    expect(ip.ipActual).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
});
