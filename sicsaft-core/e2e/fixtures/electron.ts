import {
  test as base,
  expect,
  type Browser,
  type Page,
} from "@playwright/test";
import { PUERTOS } from "../test-data";
import { resolverExe } from "../scripts/exe-path";
import {
  conectarPaginaWizard,
  esperarCisListo,
  esperarHttp,
  esperarServiciosListos,
  leerHandleExe,
} from "../scripts/exe-process";

// El `.exe` lo arranca/para global-setup/global-teardown (ver scripts/exe-process.ts). Esta
// fixture sólo se ADJUNTA por CDP al proceso ya vivo -- reconectar es instantáneo, así que
// sobrevive al reciclado de worker que Playwright hace tras cada test fallido. Cerrarla sólo
// desconecta el chromium de CDP, NO mata el `.exe`.

export interface ContextoExe {
  /** Página del renderer del wizard (por CDP). */
  page: Page;
  /** El chromium conectado por CDP (para desconectar en el teardown de la fixture). */
  browser: Browser;
  /** Puerto del DevTools Protocol del `.exe`. */
  cdpPort: number;
  /** PID del `.exe` de la corrida. */
  pid: number;
  /** true si el `.exe` corre desde una ruta con un espacio (condición del bug de PR #108). */
  empaquetadoConEspacio: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const test = base.extend<{}, { exe: ContextoExe }>({
  exe: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const handle = leerHandleExe();
      const { browser, page } = await conectarPaginaWizard(handle.cdpPort);
      try {
        await use({
          page,
          browser,
          cdpPort: handle.cdpPort,
          pid: handle.pid,
          empaquetadoConEspacio: handle.empaquetadoConEspacio,
        });
      } finally {
        await browser.close().catch(() => undefined);
      }
    },
    { scope: "worker", timeout: 90_000 },
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
