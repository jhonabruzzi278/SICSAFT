import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import {
  arrancarExe,
  conectarPaginaWizard,
  esperarExeAbajo,
  esperarServiciosListos,
  leerHandleExe,
  matarArbol,
} from "../scripts/exe-process";
import { ORG } from "../test-data";

// Relanzamiento: con la instalación ya hecha (instalacion.json presente tras el wizard de la 02),
// el `.exe` NO vuelve a mostrar el wizard -- salta directo al login, y esta vez CIS también
// arranca (en el primer arranque quedaba abajo hasta el paso 1). Este project (`ciclo-vida`) corre
// DESPUÉS de `principal`, así que la instancia compartida ya terminó su trabajo: acá se la para y
// se levanta una nueva de verdad para probar el camino de relanzamiento.

test.describe.configure({ mode: "serial" });

let browser: Browser;
let page: Page;

test.beforeAll(async () => {
  const anterior = leerHandleExe();
  await matarArbol(anterior.pid); // baja la instancia compartida de `principal`
  await esperarExeAbajo();

  const nuevo = await arrancarExe(); // relanzamiento real (reescribe .artefactos/exe.json)
  ({ browser, page } = await conectarPaginaWizard(nuevo.cdpPort));
  await esperarServiciosListos(page, { incluirCis: true });
});

test.afterAll(async () => {
  // Dejar el `.exe` vivo para la spec 13 (cierre limpio); sólo desconectar el CDP.
  await browser?.close().catch(() => undefined);
});

test.describe("12 - Relanzamiento (wizard salteado)", () => {
  test("no aparece el wizard: `getInstalacionExistente` devuelve la organización", async () => {
    const inst = await page.evaluate(() =>
      window.sicsaftCore.getInstalacionExistente(),
    );
    expect(inst?.organizacionId).toBe(ORG.id);
    expect(inst?.clienteNombre).toBe(ORG.nombre);
    expect(inst?.nivel).toBe(ORG.nivel);

    await expect(
      page.getByRole("heading", { name: "Datos de esta instalación" }),
    ).toHaveCount(0);
  });

  test("los 5 servicios (con CIS) quedan 'listo' contra los datos existentes", async () => {
    await esperarServiciosListos(page, { incluirCis: true });
    const estado = await page.evaluate(() =>
      window.sicsaftCore.getEstadoServicios(),
    );
    for (const s of ["postgres", "keycloak", "cis", "core", "cip"] as const) {
      expect(estado[s]?.estado, `${s} → ${JSON.stringify(estado[s])}`).toBe(
        "listo",
      );
    }
  });

  test("`getEstadoIpLan` expone si la IP de LAN cambió (flujo de reconfiguración)", async () => {
    const ip = await page.evaluate(() => window.sicsaftCore.getEstadoIpLan());
    // Contrato DOC-028 C.1: siempre trae `ipActual` (IPv4); `cambio` es boolean.
    expect(typeof ip.cambio).toBe("boolean");
    expect(ip.ipActual).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
  });
});
