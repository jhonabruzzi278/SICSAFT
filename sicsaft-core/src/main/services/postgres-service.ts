import { app } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ManagedProcess } from "./managed-process";

// NOTA DE HONESTIDAD (2026-08-27): esto arranca Postgres asumiendo que el binario ya está en
// `resources/postgres/` — ese binario NO está vendorizado en el repo todavía. Pendiente real (ver
// aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md "Próximo paso sugerido"): descargar los binarios
// oficiales de Windows de EDB (ZIP portable, sin instalador) y sumarlos a `resources/postgres/`,
// o resolver la descarga en tiempo de build de electron-builder. Este archivo asume esa carpeta
// ya existe con `bin/initdb.exe`/`bin/pg_ctl.exe`/`bin/postgres.exe` adentro — falla con un error
// claro si no la encuentra, no falla en silencio.

const PUERTO_POSTGRES = 55432; // no el 5432 estándar -- evita chocar con un Postgres que el
// cliente ya tenga instalado en su PC (a diferencia de devops/onprem/, donde el puerto de
// Postgres nunca se publica al host, acá SÍ corre directo en la PC del Director).

function rutaRecursosPostgres(): string {
  const base = app.isPackaged
    ? join(process.resourcesPath, "postgres")
    : join(__dirname, "..", "..", "..", "resources", "postgres");
  if (!existsSync(base)) {
    throw new Error(
      `No se encontró ${base} -- los binarios de Postgres para Windows no están vendorizados ` +
        "todavía (ver NOTA DE HONESTIDAD en postgres-service.ts). Descargar el ZIP portable " +
        "oficial de EDB y descomprimirlo ahí antes de poder arrancar este servicio.",
    );
  }
  return base;
}

function rutaDatosPostgres(): string {
  // %APPDATA%/sicsaft-core/postgres-data -- nunca dentro de la carpeta de instalación
  // (Program Files), que un usuario sin privilegios de administrador no puede escribir (ver
  // CORE-RNF-04 en aidlc-docs/sicsaft-core/requirements/REQUIREMENTS.md).
  return join(app.getPath("userData"), "postgres-data");
}

async function inicializarSiHaceFalta(binDir: string): Promise<void> {
  const dataDir = rutaDatosPostgres();
  if (existsSync(join(dataDir, "PG_VERSION"))) return; // ya inicializado en una corrida anterior

  // TODO real, no resuelto en este scaffold: initdb sin -A/--auth deja el método de
  // autenticación default de la versión de Postgres empaquetada (típicamente "trust" en un
  // initdb sin --pwfile, es decir, sin password). Aceptable como primer paso porque Postgres acá
  // solo escucha en 127.0.0.1 (nunca en la red), pero hay que decidir explícitamente si eso
  // alcanza o si hace falta generar un password real por instalación (mismo criterio que ya usan
  // CORE_DB_PASSWORD/KEYCLOAK_DB_PASSWORD en devops/onprem/.env.example) antes de dar esto por
  // cerrado.
  const { spawnSync } = await import("node:child_process");
  const resultado = spawnSync(
    join(binDir, "initdb.exe"),
    ["-D", dataDir, "-U", "sicsaft_admin"],
    {
      windowsHide: true,
    },
  );
  if (resultado.status !== 0) {
    throw new Error(
      `initdb.exe falló (código ${resultado.status}): ${resultado.stderr?.toString("utf8")}`,
    );
  }
}

export async function crearPostgresService(): Promise<ManagedProcess> {
  const recursos = rutaRecursosPostgres();
  const binDir = join(recursos, "bin");
  await inicializarSiHaceFalta(binDir);

  return new ManagedProcess({
    command: join(binDir, "postgres.exe"),
    args: [
      "-D",
      rutaDatosPostgres(),
      "-p",
      String(PUERTO_POSTGRES),
      "-c",
      "listen_addresses=127.0.0.1",
    ],
    esperarListo: async (proceso) => {
      // Postgres no expone un health-check HTTP nativo -- se detecta el patrón de log real que
      // imprime cuando ya acepta conexiones (mismo mensaje en cualquier plataforma/versión
      // reciente de Postgres). Va a stderr, no a stdout (comportamiento real de postgres.exe).
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const timeout = setTimeout(
          () =>
            rejectPromise(
              new Error(
                'Postgres no imprimió "ready to accept connections" en 30s',
              ),
            ),
          30_000,
        );
        proceso.on("stderr", (linea: string) => {
          if (
            linea.includes("database system is ready to accept connections")
          ) {
            clearTimeout(timeout);
            resolvePromise();
          }
        });
      });
    },
  });
}

export const POSTGRES_CONFIG = {
  puerto: PUERTO_POSTGRES,
  usuarioAdmin: "sicsaft_admin",
} as const;
