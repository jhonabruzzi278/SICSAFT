import { app } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import type { CuerpoEtl } from "../../shared/ipc-contract";

// Corre `herramientas/etl-contable/etl_contable.py` en modo dry-run (`--salida -`): SIN
// --cis-url/--token, así que nunca escribe en la BPI ni necesita sesión -- exactamente el modo
// que ya documenta el script ("Nunca escribe en Postgres"). Esta herramienta no vuelve a
// implementar el mapeo de columnas ni el acuñado de codigoQr: los reusa tal cual llamando al
// mismo script que ya usa sicsaft-core/src/main/services/ingesta-watcher.ts para la ingesta real
// (mismo criterio de "no duplicar lógica de negocio entre sistemas").

const TIMEOUT_ETL_MS = 120_000;
const MAX_BUFFER_ETL = 16 * 1024 * 1024;

// PATH acotado a directorios fijos e inescribibles (sonar javascript:S4036), mismo criterio que
// sicsaft-core/src/main/services/ingesta-watcher.ts.
const SYSTEM32 = join(
  process.env.SystemRoot ?? String.raw`C:\Windows`,
  "System32",
);

export interface EjecucionEtl {
  ejecutable: string;
  args: readonly string[];
  rutaAbsoluta: boolean;
}

export interface DatosEjecucionEtl {
  archivo: string;
  organizacionId: string;
  rutaMapeo?: string;
  ejecutablePython: string;
  rutaScript: string;
}

// python etl_contable.py --entrada <archivo> --organizacion <org> [--mapeo <ruta>] --salida -
export function construirEjecucionEtl(datos: DatosEjecucionEtl): EjecucionEtl {
  const args = [
    datos.rutaScript,
    "--entrada",
    datos.archivo,
    "--organizacion",
    datos.organizacionId,
    "--salida",
    "-",
  ];
  if (datos.rutaMapeo) {
    args.push("--mapeo", datos.rutaMapeo);
  }
  return {
    ejecutable: datos.ejecutablePython,
    args,
    rutaAbsoluta:
      isAbsolute(datos.ejecutablePython) ||
      /^[a-zA-Z]:[\\/]/.test(datos.ejecutablePython),
  };
}

// Rutas del ETL. El script se copia a resources/etl-contable al empaquetar; Python y sus
// dependencias siguen siendo del entorno operativo y pueden apuntarse con SICSAFT_ETL_PYTHON.
export function resolverRutasEtl(): {
  ejecutablePython: string;
  rutaScript: string;
} {
  if (app.isPackaged) {
    const base = join(process.resourcesPath, "etl-contable");
    return {
      ejecutablePython:
        process.env.SICSAFT_ETL_PYTHON ??
        (process.platform === "win32" ? "python.exe" : "python3"),
      rutaScript: join(base, "etl_contable.py"),
    };
  }
  // generador-qr/out/main -> ../../../etl-contable == herramientas/etl-contable (generador-qr es
  // una carpeta hermana dentro de herramientas/, a diferencia de sicsaft-core que está en la raíz
  // del repo y necesita un nivel más).
  const base = join(__dirname, "..", "..", "..", "etl-contable");
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

export interface GenerarEtiquetasDeps {
  // Corre el ETL. Se inyecta para poder testear sin un Python real.
  ejecutar?: (ej: EjecucionEtl) => Promise<{ stdout: string; stderr: string }>;
}

// Corre el ETL en modo dry-run y devuelve el cuerpo JSON ya parseado (`{organizacionId, origen,
// archivoNombre, filas}`), con codigoQr ya acuñado y direccionNombre/departamentoNombre/
// areaNombre ya resueltos -- listo para `agruparParaEtiquetas` en el renderer, sin tocar CIS/CORE.
export async function generarEtiquetas(
  archivo: string,
  organizacionId: string,
  rutaMapeo: string | undefined,
  deps: GenerarEtiquetasDeps = {},
): Promise<CuerpoEtl> {
  const ejecutar = deps.ejecutar ?? ejecutarEtlReal;
  const { ejecutablePython, rutaScript } = resolverRutasEtl();
  const ejecucion = construirEjecucionEtl({
    archivo,
    organizacionId,
    rutaMapeo,
    ejecutablePython,
    rutaScript,
  });
  let stdout: string;
  try {
    ({ stdout } = await ejecutar(ejecucion));
  } catch (err: unknown) {
    throw new Error(mensajeError(err));
  }
  try {
    return JSON.parse(stdout) as CuerpoEtl;
  } catch {
    throw new Error(
      "El ETL no devolvió un JSON válido — revisá el archivo de entrada y el mapeo.",
    );
  }
}
