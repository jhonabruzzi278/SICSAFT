import { app } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import {
  basename,
  delimiter,
  dirname,
  extname,
  isAbsolute,
  join,
} from "node:path";
import { FSWatcher, watch as chokidarWatch } from "chokidar";
import { PUERTO_CIS } from "./backend-configs";

// DOC-029 RF-B.6.2 -- el `.exe` vigila la carpeta que el especialista contable usa para dejar el
// Excel (elegida en el wizard, persistida como `carpetaIngesta`, ver instalacion-marker.ts). Por
// cada `.xls`/`.xlsx` nuevo corre el ETL Python (herramientas/etl-contable/etl_contable.py, ya
// existente y ya con `--organizacion/--cis-url/--token`), que normaliza el archivo y postea el
// lote a CIS -> CORE lo deja en `pendiente_revision` -> el Profesional de AFT lo aprueba/rechaza
// desde el CCP (módulo Importaciones). Este watcher NO escribe en Postgres ni habla con CORE: solo
// dispara el ETL y ordena el archivo según cómo salga.
//
// El flujo respeta la regla no negociable del ecosistema (CLAUDE.md): la fuente de captura
// (la carpeta) nunca toca la BPI directo -- todo pasa por CIS -> CORE.

const ESPERA_ESCRITURA_ESTABLE_MS = 2000;
const TIMEOUT_ETL_MS = 120_000;
const MAX_BUFFER_ETL = 16 * 1024 * 1024;
const EXTENSIONES = new Set([".xls", ".xlsx"]);
const SUBCARPETA_OK = ".procesados";
const SUBCARPETA_ERROR = ".error";
const ARCHIVO_LOG = "ingesta.log";
const CIS_URL_LOCAL = `http://127.0.0.1:${PUERTO_CIS}`;

// PATH acotado a directorios fijos e inescribibles (sonar javascript:S4036), mismo criterio que
// scripts/prepack.cjs. System32 trae las utilidades base de Windows; el resto es la carpeta del
// Python vendorizado. En dev el ejecutable es "python" a secas (no una ruta) -> se hereda el PATH
// del sistema: dev no es el producto empaquetado, y meter "." en el PATH sería justo lo que S4036
// previene.
const SYSTEM32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");

export interface EjecucionEtl {
  ejecutable: string;
  args: readonly string[];
  /** `true` cuando `ejecutable` es una ruta absoluta (python vendorizado en el `.exe`). */
  rutaAbsoluta: boolean;
}

export interface DatosEjecucionEtl {
  archivo: string;
  organizacionId: string;
  token: string;
  cisUrl?: string;
  /** `mapeo-<org>.json` opcional; si no está, el ETL usa su mapeo por defecto. */
  rutaMapeo?: string;
  ejecutablePython: string;
  rutaScript: string;
}

// Arma la línea de comandos del ETL. Idéntica al contrato de DOC-029 apéndice B.6.2:
//   python etl_contable.py --entrada <archivo> --organizacion <org> \
//     --cis-url http://127.0.0.1:56000 --token <jwt> [--mapeo <ruta>]
// El `--token` va como argumento (no por stdin/env) porque es lo que el CLI del ETL acepta hoy;
// es un access token de ~5 min y esto corre en un desktop de un solo usuario, pero queda anotado
// como deuda menor (un tercero con acceso a la lista de procesos de esa PC lo vería mientras dura
// la ejecución).
export function construirEjecucionEtl(datos: DatosEjecucionEtl): EjecucionEtl {
  const args = [
    datos.rutaScript,
    "--entrada",
    datos.archivo,
    "--organizacion",
    datos.organizacionId,
    "--cis-url",
    datos.cisUrl ?? CIS_URL_LOCAL,
    "--token",
    datos.token,
  ];
  if (datos.rutaMapeo) {
    args.push("--mapeo", datos.rutaMapeo);
  }
  return {
    ejecutable: datos.ejecutablePython,
    args,
    rutaAbsoluta: isAbsolute(datos.ejecutablePython),
  };
}

export interface ProcesarArchivoDeps {
  // Corre el ETL. Se inyecta para poder testear el orden de archivos sin un Python real. Devuelve
  // stdout/stderr; rechaza (con `stderr`/`message`) si el ETL termina con código != 0.
  ejecutar: (ej: EjecucionEtl) => Promise<{ stdout: string; stderr: string }>;
  // Reloj -- inyectable para tests deterministas.
  ahora?: () => Date;
}

function marcaDeTiempoNombre(fecha: Date): string {
  return fecha.toISOString().replace(/[:.]/g, "-");
}

async function moverA(
  archivo: string,
  carpeta: string,
  subcarpeta: string,
  fecha: Date,
): Promise<string> {
  const destinoDir = join(carpeta, subcarpeta);
  await mkdir(destinoDir, { recursive: true });
  const nombre = basename(archivo);
  // Si ya se procesó un archivo con el mismo nombre antes, no se pisa -- se le antepone la marca
  // de tiempo. El contador manda "activos.xls" cada mes, no queremos perder el del mes pasado.
  const destino = join(destinoDir, `${marcaDeTiempoNombre(fecha)}__${nombre}`);
  await rename(archivo, destino);
  return destino;
}

async function registrarLog(
  carpeta: string,
  linea: string,
  fecha: Date,
): Promise<void> {
  await appendFile(
    join(carpeta, ARCHIVO_LOG),
    `${fecha.toISOString()}  ${linea}\n`,
    "utf-8",
  );
}

function mensajeError(err: unknown): string {
  if (err && typeof err === "object") {
    const conStderr = err as { stderr?: unknown; message?: unknown };
    const stderr = conStderr.stderr;
    if (typeof stderr === "string" && stderr.trim().length > 0) {
      return stderr.trim();
    }
    if (typeof conStderr.message === "string") return conStderr.message;
  }
  return String(err);
}

export type ResultadoArchivo = "procesado" | "error";

// Corre el ETL sobre un archivo y ordena el resultado: a `.procesados/` si salió bien, a `.error/`
// (con un `<nombre>.log` al lado, el stderr del ETL) si no. Siempre deja una línea en
// `ingesta.log`. No tira: un archivo que falla no debe frenar al watcher para los siguientes.
export async function procesarArchivoIngesta(
  ejecucion: EjecucionEtl,
  contexto: { archivo: string; carpeta: string },
  deps: ProcesarArchivoDeps,
): Promise<ResultadoArchivo> {
  const ahora = deps.ahora ?? (() => new Date());
  const { archivo, carpeta } = contexto;
  const nombre = basename(archivo);
  try {
    const { stdout } = await deps.ejecutar(ejecucion);
    const fecha = ahora();
    await moverA(archivo, carpeta, SUBCARPETA_OK, fecha);
    const resumen = stdout.trim().split("\n").pop() ?? "";
    await registrarLog(carpeta, `OK   ${nombre}  ${resumen}`.trimEnd(), fecha);
    return "procesado";
  } catch (err: unknown) {
    const fecha = ahora();
    const detalle = mensajeError(err);
    let destino: string | null = null;
    try {
      destino = await moverA(archivo, carpeta, SUBCARPETA_ERROR, fecha);
      await writeFile(`${destino}.log`, `${detalle}\n`, "utf-8");
    } catch {
      // Si ni siquiera se pudo mover el archivo (permisos, disco), igual se registra abajo -- no
      // se re-tira: el watcher tiene que seguir vivo para el resto de la carpeta.
    }
    await registrarLog(
      carpeta,
      `ERR  ${nombre}  ${detalle.split("\n")[0]}`,
      fecha,
    );
    return "error";
  }
}

// Rutas del sidecar Python. Empaquetado: python vendorizado + copia del script en
// resources/etl-contable/ (ver scripts/prepack.cjs, extraResources en package.json). Dev: el
// `python` del sistema + la carpeta del repo (mismo criterio que node-backend-service.ts, que en
// dev resuelve `../../<sistema>/dist` sin copiar nada). `SICSAFT_ETL_PYTHON` permite apuntar a un
// venv concreto en dev sin tocar el PATH.
export function resolverRutasEtl(): {
  ejecutablePython: string;
  rutaScript: string;
} {
  const python = process.platform === "win32" ? "python.exe" : "bin/python3";
  if (app.isPackaged) {
    const base = join(process.resourcesPath, "etl-contable");
    return {
      ejecutablePython: join(base, "python", python),
      rutaScript: join(base, "app", "etl_contable.py"),
    };
  }
  const base = join(
    __dirname,
    "..",
    "..",
    "..",
    "herramientas",
    "etl-contable",
  );
  return {
    ejecutablePython:
      process.env.SICSAFT_ETL_PYTHON ??
      (process.platform === "win32" ? "python" : "python3"),
    rutaScript: join(base, "etl_contable.py"),
  };
}

async function ejecutarEtlReal(
  ej: EjecucionEtl,
): Promise<{ stdout: string; stderr: string }> {
  const path = ej.rutaAbsoluta
    ? [SYSTEM32, dirname(ej.ejecutable)].join(delimiter)
    : process.env.PATH;
  const { stdout, stderr } = await promisify(execFile)(
    ej.ejecutable,
    [...ej.args],
    {
      env: { ...process.env, PATH: path },
      timeout: TIMEOUT_ETL_MS,
      windowsHide: true,
      maxBuffer: MAX_BUFFER_ETL,
    },
  );
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

export interface ConfigWatcherIngesta {
  carpeta: string;
  organizacionId: string;
  // Devuelve un access token fresco de `sicsaft-ingesta` (client_credentials). Se pide uno por
  // archivo -- los tokens de servicio son cortos y un lote de varios archivos puede tardar.
  obtenerToken: () => Promise<string>;
  rutaMapeo?: string;
  cisUrl?: string;
  // Umbral de `awaitWriteFinish` de chokidar. Default 2000 ms (un `.xls` copiado por red tarda en
  // asentarse); los tests lo bajan para no esperar 2 s por archivo.
  esperaEscrituraMs?: number;
}

// Un `.xls` puede tardar en terminar de escribirse (el contador lo copia por red a la carpeta
// compartida). `awaitWriteFinish` espera a que el tamaño se estabilice antes de emitir `add`.
// `depth: 0` -> no baja a `.procesados/`/`.error/`. `ignored` -> ignora dotfiles/dotdirs.
export class IngestaWatcher {
  private watcher: FSWatcher | null = null;
  // Cola serial: un archivo por vez. Evita pelear por el token y no dispara N procesos Python de
  // golpe si alguien copia 20 archivos juntos.
  private cola: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: ConfigWatcherIngesta,
    private readonly ejecutar: (
      ej: EjecucionEtl,
    ) => Promise<{ stdout: string; stderr: string }> = ejecutarEtlReal,
  ) {}

  async iniciar(): Promise<void> {
    if (this.watcher) return;
    await mkdir(join(this.config.carpeta, SUBCARPETA_OK), { recursive: true });
    await mkdir(join(this.config.carpeta, SUBCARPETA_ERROR), {
      recursive: true,
    });
    const estabilidadMs =
      this.config.esperaEscrituraMs ?? ESPERA_ESCRITURA_ESTABLE_MS;
    this.watcher = chokidarWatch(this.config.carpeta, {
      ignoreInitial: true,
      depth: 0,
      ignored: (ruta: string) => basename(ruta).startsWith("."),
      awaitWriteFinish: {
        stabilityThreshold: estabilidadMs,
        pollInterval: Math.min(
          300,
          Math.max(20, Math.floor(estabilidadMs / 4)),
        ),
      },
    });
    this.watcher.on("add", (ruta: string) => {
      if (!EXTENSIONES.has(extname(ruta).toLowerCase())) return;
      this.encolar(ruta);
    });
    // Esperar el scan inicial: con `ignoreInitial: true`, un archivo que aparece mientras
    // chokidar todavía recorre la carpeta puede quedar clasificado como "ya estaba" y no emitir
    // `add`. Devolver recién cuando está `ready` -- el wiring (ipc/handlers.ts) sabe entonces que
    // los archivos nuevos sí se van a captar. Tope de seguridad por si `ready` no llega.
    await new Promise<void>((resolver) => {
      const t = setTimeout(resolver, 10_000);
      this.watcher?.once("ready", () => {
        clearTimeout(t);
        resolver();
      });
    });
  }

  private encolar(archivo: string): void {
    this.cola = this.cola
      .then(() => this.procesar(archivo))
      .catch(() => {
        // procesarArchivoIngesta ya no tira; este catch es una red de seguridad para que un fallo
        // inesperado (p.ej. obtenerToken) no rompa la cadena de la cola.
      });
  }

  private async procesar(archivo: string): Promise<void> {
    const token = await this.config.obtenerToken();
    const { ejecutablePython, rutaScript } = resolverRutasEtl();
    const ejecucion = construirEjecucionEtl({
      archivo,
      organizacionId: this.config.organizacionId,
      token,
      cisUrl: this.config.cisUrl,
      rutaMapeo: this.config.rutaMapeo,
      ejecutablePython,
      rutaScript,
    });
    await procesarArchivoIngesta(
      ejecucion,
      { archivo, carpeta: this.config.carpeta },
      { ejecutar: this.ejecutar },
    );
  }

  async detener(): Promise<void> {
    if (!this.watcher) return;
    await this.watcher.close();
    this.watcher = null;
    await this.cola.catch(() => undefined);
  }
}

// Un solo watcher activo por proceso (una instalación = un cliente = una carpeta). El wiring
// (ipc/handlers.ts) llama a esto tras arrancar cis y de nuevo cuando el usuario cambia la carpeta
// desde el wizard; `index.ts` lo apaga en `before-quit`.
let watcherActivo: IngestaWatcher | null = null;

export async function reconfigurarWatcherIngesta(
  config: ConfigWatcherIngesta | null,
): Promise<void> {
  await watcherActivo?.detener();
  watcherActivo = null;
  if (config?.carpeta) {
    watcherActivo = new IngestaWatcher(config);
    await watcherActivo.iniciar();
  }
}

export function detenerWatcherIngesta(): Promise<void> {
  const actual = watcherActivo;
  watcherActivo = null;
  return actual ? actual.detener() : Promise.resolve();
}

export function hayWatcherIngestaActivo(): boolean {
  return watcherActivo !== null;
}
