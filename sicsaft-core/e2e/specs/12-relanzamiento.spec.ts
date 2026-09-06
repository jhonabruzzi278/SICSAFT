import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { resolverExe } from "../scripts/exe-path";
import {
  barrerHuerfanos,
  esperarServiciosListos,
  matarArbol,
} from "../scripts/exe-process";
import { ORG } from "../test-data";

// Relanzamiento: con la instalación ya hecha (instalacion.json presente tras el wizard de la 02),
// el `.exe` NO vuelve a mostrar el wizard -- salta directo al login, y esta vez CIS también
// arranca (en el primer arranque quedaba abajo hasta el paso 1). Este project (`ciclo-vida`) corre
// DESPUÉS de `principal`, así que su `.exe` ya se cerró: acá se lanza una instancia nueva de
// verdad (mismo `%APPDATA%` aislado y persistido) para probar el camino de relanzamiento.

test.describe.configure({ mode: "serial" });

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  await barrerHuerfanos();
  const { exe } = resolverExe();
  app = await electron.launch({
    executablePath: exe,
    args: [],
    timeout: 60_000,
  });
  page = await app.firstWindow({ timeout: 60_000 });
  await page.waitForLoadState("domcontentloaded");
  await esperarServiciosListos(page, { incluirCis: true });
});

test.afterAll(async () => {
  const pid = app?.process().pid;
  await Promise.race([
    app?.close().catch(() => undefined),
    new Promise((r) => setTimeout(r, 15_000)),
  ]);
  if (pid) await matarArbol(pid);
  await barrerHuerfanos();
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
