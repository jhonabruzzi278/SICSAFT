import {
  test as base,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { PUERTOS } from "../test-data";
import { resolverExe } from "../scripts/exe-path";
import {
  barrerHuerfanos,
  esperarCisListo,
  esperarHttp,
  esperarServiciosListos,
  matarArbol,
} from "../scripts/exe-process";

// Un solo `.exe` vivo para todo el project `principal` (workers:1), vía `_electron.launch`.
// global-setup/global-teardown aíslan/restauran `%APPDATA%\sicsaft-core` y barren huérfanos.
//
// `connectOverCDP` no sirve contra este build de Electron (el handshake CDP se cuelga), así que
// se usa `_electron.launch`. El teardown NO espera indefinidamente el `app.close()` (se colgaba
// 120s porque el `.exe` deja huérfano el `java` de Keycloak en Windows y su pipe queda abierto):
// se le da un tope y después se remata el árbol con `taskkill /T`.

export interface ContextoExe {
  /** El proceso Electron del `.exe`. */
  app: ElectronApplication;
  /** La ventana principal (renderer del wizard / consola técnica). */
  page: Page;
  /** true si el `.exe` corre desde una ruta con un espacio (condición del bug de PR #108). */
  empaquetadoConEspacio: boolean;
}

async function cerrarAcotado(app: ElectronApplication): Promise<void> {
  // Nunca tira: cualquier fallo acá deja el worker "sucio" y Playwright cuelga el teardown 120s.
  let pid: number | undefined;
  try {
    pid = app.process().pid;
  } catch {
    /* el proceso ya no existe */
  }
  try {
    await Promise.race([
      app.close().catch(() => undefined),
      new Promise((r) => setTimeout(r, 12_000)),
    ]);
  } catch {
    /* ignore */
  }
  if (pid) await matarArbol(pid).catch(() => undefined); // remata el `java` huérfano de Keycloak
  await barrerHuerfanos().catch(() => undefined);
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const test = base.extend<{}, { exe: ContextoExe }>({
  exe: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const { exe, empaquetadoConEspacio } = resolverExe();
      const app = await electron.launch({
        executablePath: exe,
        // `--disable-gpu` reduce la superficie de crash del proceso utilitario de Chromium
        // (el "network service crashed" que tiraba la sesión CDP a mitad de un page.evaluate).
        args: ["--disable-gpu"],
        timeout: 60_000,
      });
      const page = await app.firstWindow({ timeout: 60_000 });
      await page.waitForLoadState("domcontentloaded");
      await esperarServiciosListos(page);
      try {
        await use({ app, page, empaquetadoConEspacio });
      } finally {
        await cerrarAcotado(app);
      }
    },
    { scope: "worker", timeout: 8 * 60_000 },
  ],
});

export {
  expect,
  PUERTOS,
  resolverExe,
  esperarServiciosListos,
  esperarCisListo,
  esperarHttp,
};
