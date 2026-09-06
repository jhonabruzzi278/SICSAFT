// Ciclo de vida del `.exe` MANEJADO FUERA del modelo de workers de Playwright: global-setup lo
// arranca una vez, global-teardown lo mata (árbol completo, `taskkill /T`). Las specs sólo se
// ADJUNTAN por CDP (`--remote-debugging-port`) -- reconectar es instantáneo y sobrevive al
// reciclado de worker que Playwright hace tras cada test fallido (con `_electron.launch` dentro de
// una fixture worker, cada fallo forzaba un reboot de 3-4 min del `.exe`). `taskkill /T` además
// mata el `java` de Keycloak, que el propio `.exe` deja huérfano al cerrar en Windows
// (ManagedProcess.detener manda SIGTERM sólo al cmd.exe intermedio -- bug del `.exe`, aparte).
import { chromium, type Browser, type Page } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";
import { resolverExe } from "./exe-path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARCHIVO_HANDLE = join(AQUI, "..", ".artefactos", "exe.json");

/** Puerto fijo del DevTools Protocol del `.exe` -- fuera del rango de servicios (55432-58090). */
export const PUERTO_CDP = 58099;
const PUERTO_POSTGRES = 55432;
const URL_WELLKNOWN_MASTER =
  "http://127.0.0.1:58080/realms/master/.well-known/openid-configuration";

const SERVICIOS_PRE_WIZARD = ["postgres", "keycloak", "core", "cip"] as const;
const SERVICIOS_TODOS = ["postgres", "keycloak", "cis", "core", "cip"] as const;

export interface HandleExe {
  pid: number;
  cdpPort: number;
  empaquetadoConEspacio: boolean;
}

// ----------------------------------------------------------------------------- handle en disco

function escribirHandle(h: HandleExe): void {
  mkdirSync(dirname(ARCHIVO_HANDLE), { recursive: true });
  writeFileSync(ARCHIVO_HANDLE, JSON.stringify(h, null, 2));
}

export function leerHandleExe(): HandleExe {
  if (!existsSync(ARCHIVO_HANDLE)) {
    throw new Error(
      `Falta ${ARCHIVO_HANDLE} -- global-setup tiene que arrancar el \`.exe\` primero.`,
    );
  }
  return JSON.parse(readFileSync(ARCHIVO_HANDLE, "utf8")) as HandleExe;
}

function borrarHandle(): void {
  if (existsSync(ARCHIVO_HANDLE)) rmSync(ARCHIVO_HANDLE, { force: true });
}

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

/** `true` si Keycloak (realm master) y Postgres ya responden -- chequeo barato sin CDP. */
export async function serviciosHttpArriba(): Promise<boolean> {
  return (
    (await status(URL_WELLKNOWN_MASTER)) === 200 && (await postgresAcepta())
  );
}

/** Espera a que Keycloak y Postgres dejen de responder (tras parar el `.exe`). */
export async function esperarExeAbajo(timeoutMs = 30_000): Promise<void> {
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

// ----------------------------------------------------------------------------- estado por CDP

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

// ----------------------------------------------------------------------------- arranque / adjunto

/**
 * Lanza el `.exe` con el DevTools Protocol abierto y espera a que el endpoint CDP responda.
 * No espera los servicios embebidos -- de eso se encarga `esperarServiciosBase`.
 */
export async function arrancarExe(): Promise<HandleExe> {
  const { exe, empaquetadoConEspacio } = resolverExe();

  const hijo = spawn(exe, [`--remote-debugging-port=${PUERTO_CDP}`], {
    stdio: "ignore",
    windowsHide: false,
    detached: false,
  });
  hijo.unref();

  if (!hijo.pid) throw new Error("spawn del `.exe` no devolvió pid");

  for (let i = 0; i < 120; i += 1) {
    if ((await status(`http://127.0.0.1:${PUERTO_CDP}/json/version`)) === 200) {
      const handle: HandleExe = {
        pid: hijo.pid,
        cdpPort: PUERTO_CDP,
        empaquetadoConEspacio,
      };
      escribirHandle(handle);
      return handle;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  await matarArbol(hijo.pid);
  throw new Error(
    `El \`.exe\` no abrió el DevTools Protocol en :${PUERTO_CDP} tras 60s`,
  );
}

/**
 * Abre la conexión CDP al `.exe`. Reintenta: en el arranque el endpoint HTTP contesta
 * `/json/version` antes de que el handshake CDP completo ande (el proceso principal está
 * saturado levantando los 4 servicios embebidos) y `connectOverCDP` puede colgar el handshake.
 */
async function conectarCdp(cdpPort: number): Promise<Browser> {
  const fin = Date.now() + 150_000;
  for (let intento = 1; ; intento += 1) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`, {
        timeout: 45_000,
      });
    } catch (e) {
      if (Date.now() > fin) {
        throw new Error(
          `No pude conectar por CDP a :${cdpPort} tras ${intento} intentos: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

/**
 * Conecta un chromium por CDP al `.exe` y devuelve la página del renderer del wizard (no la
 * WebContentsView del login embebido). Reintenta hasta que `window.sicsaftCore` esté expuesto.
 */
export async function conectarPaginaWizard(
  cdpPort: number,
): Promise<{ browser: Browser; page: Page }> {
  const browser = await conectarCdp(cdpPort);
  const fin = Date.now() + 60_000;
  for (;;) {
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        if (!p.url().includes("renderer/index.html")) continue;
        try {
          await p.waitForFunction(() => "sicsaftCore" in window, {
            timeout: 5_000,
          });
          return { browser, page: p };
        } catch {
          // el renderer todavía no montó el contextBridge -- reintentar
        }
      }
    }
    if (Date.now() > fin) {
      await browser.close().catch(() => undefined);
      throw new Error(
        "No encontré la página del renderer del wizard con `window.sicsaftCore` por CDP",
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Conecta por CDP y espera los servicios base (o los 5 con `incluirCis`). Cierra la conexión. */
export async function esperarServiciosBase(
  cdpPort: number,
  opciones: { incluirCis?: boolean; timeoutMs?: number } = {},
): Promise<void> {
  const { browser, page } = await conectarPaginaWizard(cdpPort);
  try {
    await esperarServiciosListos(page, opciones);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

// ----------------------------------------------------------------------------- detención
//
// `taskkill` async y `await`-eado (NO spawnSync): invocado desde global-teardown de Playwright,
// `spawnSync` disparaba `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` de libuv (el
// event loop ya tiene handles cerrándose). Con execFile async libuv los ordena bien.

const ejecutar = promisify(execFile);

async function taskkill(args: string[]): Promise<void> {
  try {
    await ejecutar("taskkill", args, { windowsHide: true });
  } catch {
    // el proceso ya no existe / no se pudo -- no es error para el harness
  }
}

/** Mata el árbol de procesos (incluye el `java` de Keycloak y los `postgres`). */
export async function matarArbol(pid: number): Promise<void> {
  await taskkill(["/pid", String(pid), "/T", "/F"]);
}

/** Pide cierre "de ventana" (WM_CLOSE) -> dispara el `before-quit` limpio del `.exe`. */
export async function pedirCierreLimpio(pid: number): Promise<void> {
  await taskkill(["/pid", String(pid), "/T"]);
}

/** Barrido de seguridad: cualquier `.exe`/`java`/`postgres` que haya quedado suelto. */
export async function barrerHuerfanos(): Promise<void> {
  for (const imagen of ["SICSAFT CORE.exe", "java.exe", "postgres.exe"]) {
    await taskkill(["/im", imagen, "/T", "/F"]);
  }
}

/**
 * Detiene el `.exe` de la corrida y borra el handle.
 * `duro=false` (default): pide cierre de ventana (before-quit limpio) y luego remata el árbol.
 * `duro=true`: taskkill /F directo (para el final de la corrida -- ya nada necesita los servicios).
 */
export async function pararExe({
  duro = false,
}: { duro?: boolean } = {}): Promise<void> {
  try {
    const { pid } = leerHandleExe();
    if (duro) {
      await matarArbol(pid);
    } else {
      await pedirCierreLimpio(pid);
      for (let i = 0; i < 20; i += 1) {
        if (!(await serviciosHttpArriba())) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      await matarArbol(pid); // remata el `java` huérfano de Keycloak, etc.
    }
  } catch {
    // sin handle -- nada que parar por pid
  } finally {
    await barrerHuerfanos();
    borrarHandle();
  }
}
