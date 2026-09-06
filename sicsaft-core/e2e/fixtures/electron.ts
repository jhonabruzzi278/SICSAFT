import {
  test as base,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUERTOS } from "../test-data";

const AQUI = dirname(fileURLToPath(import.meta.url));

// Resuelve el ejecutable del `.exe` a probar, en orden de preferencia:
//   1. SICSAFT_CORE_EXE (override explícito)
//   2. la instalación real: %LOCALAPPDATA%\Programs\SICSAFT CORE\SICSAFT CORE.exe
//      -- ES la ruta con un espacio; cubre el bug de kc.bat spawneado sin comillas (PR #108).
//   3. release\win-unpacked\SICSAFT CORE.exe (tras `npm run pack` -- sin espacio, no cubre #108)
export function resolverExe(): { exe: string; empaquetadoConEspacio: boolean } {
  const override = process.env.SICSAFT_CORE_EXE;
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`SICSAFT_CORE_EXE apunta a ${override}, que no existe`);
    }
    return { exe: override, empaquetadoConEspacio: / /.test(override) };
  }
  const instalado = join(
    process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"),
    "Programs",
    "SICSAFT CORE",
    "SICSAFT CORE.exe",
  );
  if (existsSync(instalado)) {
    return { exe: instalado, empaquetadoConEspacio: true };
  }
  const winUnpacked = join(
    AQUI,
    "..",
    "..",
    "release",
    "win-unpacked",
    "SICSAFT CORE.exe",
  );
  if (existsSync(winUnpacked)) {
    return { exe: winUnpacked, empaquetadoConEspacio: false };
  }
  throw new Error(
    "No encontré el `.exe`. Corré `npm run dist:win` (y opcionalmente instalá el Setup) " +
      "o seteá SICSAFT_CORE_EXE.",
  );
}

export interface ContextoExe {
  /** El proceso Electron del `.exe`. */
  app: ElectronApplication;
  /** La ventana principal (renderer del wizard / consola técnica). */
  page: Page;
  /** true si el `.exe` corre desde una ruta con un espacio (condición del bug de PR #108). */
  empaquetadoConEspacio: boolean;
}

// En el PRIMER arranque sólo suben 4: cis arranca recién cuando el wizard (paso 1) crea sus
// credenciales de Keycloak (ver src/main/services/service-orchestrator.ts iniciarCis + el
// handler bootstrapCliente). En un relanzamiento con el wizard ya hecho, cis lo levanta
// getInstalacionExistente() y sí suben los 5.
const SERVICIOS_PRE_WIZARD = ["postgres", "keycloak", "core", "cip"] as const;
const SERVICIOS_TODOS = ["postgres", "keycloak", "cis", "core", "cip"] as const;

/**
 * Espera hasta que los servicios embebidos estén en `listo` (o alguno en `error`).
 * @param incluirCis  true para exigir también cis (post-wizard / relanzamiento).
 */
export async function esperarServiciosListos(
  page: Page,
  { incluirCis = false, timeoutMs = 6 * 60_000 } = {},
): Promise<Record<string, { estado: string; detalle?: string }>> {
  const claves = incluirCis ? SERVICIOS_TODOS : SERVICIOS_PRE_WIZARD;
  const inicio = Date.now();
  for (;;) {
    const estado = await page.evaluate(() =>
      window.sicsaftCore.getEstadoServicios(),
    );
    const enError = claves.filter((s) => estado[s]?.estado === "error");
    if (enError.length > 0) {
      throw new Error(
        `Servicios en error: ${enError
          .map((s) => `${s} (${estado[s]?.detalle ?? "sin detalle"})`)
          .join(", ")}`,
      );
    }
    const listos = claves.filter((s) => estado[s]?.estado === "listo");
    if (listos.length === claves.length) return estado;
    if (Date.now() - inicio > timeoutMs) {
      throw new Error(
        `Timeout esperando servicios (${claves.join(",")}). Estado: ${JSON.stringify(estado)}`,
      );
    }
    await page.waitForTimeout(2000);
  }
}

/** Espera a que cis quede `listo` (tras el paso 1 del wizard). */
export async function esperarCisListo(
  page: Page,
  timeoutMs = 90_000,
): Promise<void> {
  const inicio = Date.now();
  for (;;) {
    const estado = await page.evaluate(() =>
      window.sicsaftCore.getEstadoServicios(),
    );
    if (estado.cis?.estado === "listo") return;
    if (estado.cis?.estado === "error") {
      throw new Error(`cis en error: ${estado.cis?.detalle ?? "sin detalle"}`);
    }
    if (Date.now() - inicio > timeoutMs) {
      throw new Error(
        `Timeout esperando cis. Estado: ${JSON.stringify(estado.cis)}`,
      );
    }
    await page.waitForTimeout(2000);
  }
}

/** Poll HTTP genérico contra los servidores embebidos (portales / Keycloak). */
export async function esperarHttp(
  url: string,
  { intentos = 60, aceptar = (s: number) => s >= 200 && s < 500 } = {},
): Promise<void> {
  for (let i = 1; i <= intentos; i += 1) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (aceptar(res.status)) return;
    } catch {
      // el servidor todavía no levanta
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout esperando ${url}`);
}

// Fixture worker-scoped: un solo `.exe` vivo para todo el project `principal` (workers: 1). El
// aislamiento/restauración de %APPDATA% lo hacen global-setup/global-teardown (abarca los dos
// projects). Las specs de ciclo de vida (12/13, project `ciclo-vida`) NO usan esta fixture --
// lanzan su propia instancia porque para entonces ésta ya se cerró.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const test = base.extend<{}, { exe: ContextoExe }>({
  exe: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const { exe, empaquetadoConEspacio } = resolverExe();

      const app = await electron.launch({
        executablePath: exe,
        args: [],
        timeout: 60_000,
      });

      const page = await app.firstWindow({ timeout: 60_000 });
      await page.waitForLoadState("domcontentloaded");
      await esperarServiciosListos(page);

      try {
        await use({ app, page, empaquetadoConEspacio });
      } finally {
        await app.close().catch(() => undefined);
      }
    },
    { scope: "worker", timeout: 8 * 60_000 },
  ],
});

export { expect, PUERTOS };
