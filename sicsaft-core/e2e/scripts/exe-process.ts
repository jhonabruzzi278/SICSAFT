// Helpers de servicios embebidos + limpieza de procesos del `.exe`.
//
// El `.exe` se lanza con `_electron.launch` (Playwright) desde la fixture worker `exe`
// (fixtures/electron.ts) y desde las specs de ciclo de vida (12/13). No se usa
// `chromium.connectOverCDP`: contra este build de Electron el handshake CDP se cuelga.
//
// `matarArbol` / `barrerHuerfanos` matan el árbol de procesos con `taskkill /T` -- necesario
// porque al cerrar el `.exe` en Windows queda huérfano el `java` de Keycloak
// (ManagedProcess.detener manda SIGTERM sólo al `cmd.exe` intermedio de `kc.bat`). Sin esto el
// puerto 58080 sigue tomado y el `app.close()` de `_electron` se cuelga esperando ese pipe.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Page } from "@playwright/test";
import { Client } from "pg";

const PUERTO_POSTGRES = 55432;
const URL_WELLKNOWN_MASTER =
  "http://127.0.0.1:58080/realms/master/.well-known/openid-configuration";

const SERVICIOS_PRE_WIZARD = ["postgres", "keycloak", "core", "cip"] as const;
const SERVICIOS_TODOS = ["postgres", "keycloak", "cis", "core", "cip"] as const;

// ----------------------------------------------------------------------------- chequeos HTTP/PG

async function status(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.status;
  } catch {
    return null;
  }
}

async function postgresAcepta(): Promise<boolean> {
  const cli = new Client({
    host: "127.0.0.1",
    port: PUERTO_POSTGRES,
    user: "sicsaft_admin",
    database: "postgres",
    connectionTimeoutMillis: 2000,
  });
  try {
    await cli.connect();
    await cli.end();
    return true;
  } catch {
    return false;
  }
}

/** Poll HTTP genérico contra los servidores embebidos (portales / Keycloak). */
export async function esperarHttp(
  url: string,
  { intentos = 60, aceptar = (s: number) => s >= 200 && s < 500 } = {},
): Promise<void> {
  for (let i = 1; i <= intentos; i += 1) {
    const s = await status(url);
    if (s !== null && aceptar(s)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout esperando ${url}`);
}

/** `true` si Keycloak (realm master) y Postgres ya responden -- chequeo barato sin renderer. */
export async function serviciosHttpArriba(): Promise<boolean> {
  return (
    (await status(URL_WELLKNOWN_MASTER)) === 200 && (await postgresAcepta())
  );
}

/** Espera a que Keycloak y Postgres dejen de responder (tras parar el `.exe`). */
export async function esperarExeAbajo(timeoutMs = 40_000): Promise<void> {
  const fin = Date.now() + timeoutMs;
  while (Date.now() < fin) {
    const kc = await status(URL_WELLKNOWN_MASTER);
    if (kc === null && !(await postgresAcepta())) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(
    "El `.exe` no bajó del todo tras pararlo (puertos siguen ocupados)",
  );
}

// ----------------------------------------------------------------------------- estado por IPC

type EstadoServicios = Record<string, { estado: string; detalle?: string }>;

async function leerEstadoServicios(page: Page): Promise<EstadoServicios> {
  return page.evaluate(() => window.sicsaftCore.getEstadoServicios());
}

/**
 * Espera hasta que los servicios embebidos estén `listo` (o alguno en `error`), mirando
 * `getEstadoServicios()` en el renderer. En el PRIMER arranque sólo suben 4: cis arranca recién
 * cuando el wizard (paso 1) crea sus credenciales de Keycloak. Con `incluirCis` se exigen los 5
 * (post-wizard / relanzamiento).
 */
export async function esperarServiciosListos(
  page: Page,
  { incluirCis = false, timeoutMs = 6 * 60_000 } = {},
): Promise<EstadoServicios> {
  const claves = incluirCis ? SERVICIOS_TODOS : SERVICIOS_PRE_WIZARD;
  const fin = Date.now() + timeoutMs;
  for (;;) {
    const estado = await leerEstadoServicios(page);
    const enError = claves.filter((s) => estado[s]?.estado === "error");
    if (enError.length > 0) {
      throw new Error(
        `Servicios en error: ${enError
          .map((s) => `${s} (${estado[s]?.detalle ?? "sin detalle"})`)
          .join(", ")}`,
      );
    }
    if (claves.every((s) => estado[s]?.estado === "listo")) return estado;
    if (Date.now() > fin) {
      throw new Error(
        `Timeout esperando servicios [${claves.join(",")}]. Estado: ${JSON.stringify(estado)}`,
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
  const fin = Date.now() + timeoutMs;
  for (;;) {
    const estado = await leerEstadoServicios(page);
    if (estado.cis?.estado === "listo") return;
    if (estado.cis?.estado === "error") {
      throw new Error(`cis en error: ${estado.cis?.detalle ?? "sin detalle"}`);
    }
    if (Date.now() > fin) {
      throw new Error(
        `Timeout esperando cis. Estado: ${JSON.stringify(estado.cis)}`,
      );
    }
    await page.waitForTimeout(2000);
  }
}

// ----------------------------------------------------------------------------- limpieza procesos
//
// `taskkill` async y `await`-eado (NO spawnSync): invocado desde el teardown de Playwright,
// `spawnSync` disparaba `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` de libuv.

const ejecutar = promisify(execFile);

async function taskkill(args: string[]): Promise<void> {
  try {
    await ejecutar("taskkill", args, { windowsHide: true });
  } catch {
    // el proceso ya no existe / no se pudo -- no es error para el harness
  }
}

/** Mata el árbol de procesos por pid (incluye el `java` de Keycloak y los `postgres`). */
export async function matarArbol(pid: number): Promise<void> {
  await taskkill(["/pid", String(pid), "/T", "/F"]);
}

/** Barrido de seguridad: cualquier `.exe`/`java`/`postgres` que haya quedado suelto. */
export async function barrerHuerfanos(): Promise<void> {
  for (const imagen of ["SICSAFT CORE.exe", "java.exe", "postgres.exe"]) {
    await taskkill(["/im", imagen, "/T", "/F"]);
  }
}
