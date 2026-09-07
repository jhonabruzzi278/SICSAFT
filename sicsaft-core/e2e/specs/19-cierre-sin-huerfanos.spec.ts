import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import { resolverExe } from "../scripts/exe-path";
import {
  barrerHuerfanos,
  esperarExeAbajo,
  esperarServiciosListos,
  matarArbol,
  serviciosHttpArriba,
} from "../scripts/exe-process";

// Bug real reportado tras la primera entrega: al cerrar la app en Windows quedaba vivo el
// `java.exe` de Keycloak. `ManagedProcess.detener()` hacía `child.kill('SIGTERM')`, que en Windows
// es un TerminateProcess del hijo DIRECTO -- y como Keycloak arranca por `kc.bat` con `shell:true`,
// el hijo directo es un `cmd.exe` y el `java` real es un nieto. Resultado: el puerto 58080 seguía
// tomado y **el segundo arranque de la app fallaba**. El fix baja el árbol con `taskkill /T`.
//
// Esta spec es la regresión de ese bug y, a propósito, **NO usa la red de seguridad del harness**
// (`matarArbol`/`barrerHuerfanos`) entre el cierre y las aserciones: si el `.exe` deja huérfanos,
// acá se ve. Barre sólo ANTES de empezar (para partir limpio) y DESPUÉS de aseverar (para no
// dejarle basura a nadie).

const TIMEOUT_ARRANQUE = 6 * 60_000;

async function lanzar(): Promise<ElectronApplication> {
  const { exe } = resolverExe();
  return electron.launch({
    executablePath: exe,
    args: ["--disable-gpu"],
    timeout: 60_000,
  });
}

test.describe.configure({ mode: "serial" });

test.describe("19 - Cierre sin huérfanos y relanzamiento (bug del java de Keycloak)", () => {
  test("cerrar la app libera los puertos: no queda Keycloak ni Postgres vivos", async () => {
    test.setTimeout(TIMEOUT_ARRANQUE + 120_000);
    await barrerHuerfanos(); // partir de cero -- lo que se mide es lo que pasa DESPUÉS del close

    const app = await lanzar();
    const page = await app.firstWindow({ timeout: 60_000 });
    await page.waitForLoadState("domcontentloaded");
    await esperarServiciosListos(page, { incluirCis: true });
    expect(
      await serviciosHttpArriba(),
      "los servicios embebidos no estaban arriba antes de cerrar",
    ).toBe(true);

    const pid = app.process().pid;
    const t0 = Date.now();
    await Promise.race([
      app.close().catch(() => undefined),
      new Promise((r) => setTimeout(r, 60_000)),
    ]);
    const msCierre = Date.now() - t0;

    // Sin el fix, `esperarExeAbajo` se agota: el `java` huérfano sigue sirviendo 58080.
    let quedaronVivos: string | null = null;
    try {
      await esperarExeAbajo(45_000);
    } catch (err) {
      quedaronVivos = err instanceof Error ? err.message : String(err);
    }

    // Limpieza DESPUÉS de medir -- si falló, igual dejamos la máquina usable para el resto.
    if (pid) await matarArbol(pid).catch(() => undefined);
    await barrerHuerfanos().catch(() => undefined);

    expect(
      quedaronVivos,
      `tras cerrar la app quedaron procesos con los puertos tomados (el bug del java huérfano). ` +
        `close() tardó ${msCierre}ms. Detalle: ${quedaronVivos}`,
    ).toBeNull();
  });

  test("tras ese cierre, la app vuelve a arrancar sola (sin matar nada a mano)", async () => {
    test.setTimeout(TIMEOUT_ARRANQUE + 120_000);
    // A propósito SIN barrerHuerfanos(): si el test anterior dejó algo vivo, este arranque falla
    // igual que le pasaría al cliente al reabrir la app.
    const app = await lanzar();
    let pid: number | undefined;
    try {
      pid = app.process().pid;
      const page = await app.firstWindow({ timeout: 60_000 });
      await page.waitForLoadState("domcontentloaded");
      const estado = await esperarServiciosListos(page, { incluirCis: true });
      for (const s of ["postgres", "keycloak", "cis", "core", "cip"] as const) {
        expect(estado[s]?.estado, `${s} → ${JSON.stringify(estado[s])}`).toBe(
          "listo",
        );
      }
    } finally {
      await Promise.race([
        app.close().catch(() => undefined),
        new Promise((r) => setTimeout(r, 30_000)),
      ]);
      if (pid) await matarArbol(pid).catch(() => undefined);
      await barrerHuerfanos().catch(() => undefined);
    }
  });
});
