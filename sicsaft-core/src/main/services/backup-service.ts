import { app, shell } from "electron";
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { log } from "./logger";

export interface RespaldoInfo {
  nombre: string;
  ruta: string;
  tamanoBytes: number;
  fechaCreacion: string;
}

export function rutaCarpetaRespaldos(): string {
  const dir = join(app.getPath("userData"), "backups");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function rutaRecursosPostgres(): string {
  const base = app.isPackaged
    ? join(process.resourcesPath, "postgres")
    : join(__dirname, "..", "..", "resources", "postgres");
  return base;
}

export async function crearRespaldoBpi(): Promise<RespaldoInfo> {
  const carpetaRespaldos = rutaCarpetaRespaldos();
  const ahora = new Date();
  const timestamp = ahora.toISOString().replace(/[:.]/g, "-");
  const nombreArchivo = `sicsaft-bpi-backup-${timestamp}.sql`;
  const rutaDestino = join(carpetaRespaldos, nombreArchivo);

  log(`[backup-service] Iniciando respaldo de emergencia en ${rutaDestino}`);

  const recursos = rutaRecursosPostgres();
  const pgDumpall = join(recursos, "bin", "pg_dumpall.exe");
  const pgDump = join(recursos, "bin", "pg_dump.exe");

  // Intentar pg_dumpall primero para volcar todas las bases (core, keycloak, cip)
  if (existsSync(pgDumpall)) {
    try {
      const res = spawnSync(
        pgDumpall,
        ["-p", "55432", "-h", "127.0.0.1", "-U", "sicsaft_admin", "-f", rutaDestino],
        { windowsHide: true, timeout: 60000 }
      );
      if (res.status === 0 && existsSync(rutaDestino) && statSync(rutaDestino).size > 0) {
        log(`[backup-service] pg_dumpall completado con éxito: ${statSync(rutaDestino).size} bytes`);
        // Respaldar también instalacion.json junto al dump
        respaldarInstalacionJson(carpetaRespaldos, timestamp);
        return {
          nombre: nombreArchivo,
          ruta: rutaDestino,
          tamanoBytes: statSync(rutaDestino).size,
          fechaCreacion: ahora.toISOString(),
        };
      }
      log(`[backup-service] pg_dumpall retornó status ${res.status}: ${res.stderr?.toString()}`);
    } catch (err) {
      log(`[backup-service] Error ejecutando pg_dumpall: ${err}`);
    }
  }

  // Fallback a pg_dump de la base de CORE (sicsaft_core)
  if (existsSync(pgDump)) {
    try {
      const res = spawnSync(
        pgDump,
        ["-p", "55432", "-h", "127.0.0.1", "-U", "sicsaft_admin", "-d", "sicsaft_core", "-f", rutaDestino],
        { windowsHide: true, timeout: 60000 }
      );
      if (res.status === 0 && existsSync(rutaDestino) && statSync(rutaDestino).size > 0) {
        log(`[backup-service] pg_dump sicsaft_core completado: ${statSync(rutaDestino).size} bytes`);
        respaldarInstalacionJson(carpetaRespaldos, timestamp);
        return {
          nombre: nombreArchivo,
          ruta: rutaDestino,
          tamanoBytes: statSync(rutaDestino).size,
          fechaCreacion: ahora.toISOString(),
        };
      }
    } catch (err) {
      log(`[backup-service] Error ejecutando pg_dump fallback: ${err}`);
    }
  }

  // Si postgres no está en ejecución o falló el dump lógico, respaldar archivo de instalacion
  respaldarInstalacionJson(carpetaRespaldos, timestamp);
  throw new Error(
    "No se pudo generar el volcado SQL de Postgres. Verifique que el servicio de Postgres esté iniciado."
  );
}

function respaldarInstalacionJson(carpetaRespaldos: string, timestamp: string): void {
  const rutaInstalacion = join(app.getPath("userData"), "instalacion.json");
  if (existsSync(rutaInstalacion)) {
    const destinoConfig = join(carpetaRespaldos, `instalacion-${timestamp}.json`);
    try {
      copyFileSync(rutaInstalacion, destinoConfig);
    } catch {
      // no bloqueante
    }
  }
}

export function listarRespaldos(): RespaldoInfo[] {
  const dir = rutaCarpetaRespaldos();
  if (!existsSync(dir)) return [];

  const archivos = readdirSync(dir);
  const respaldos: RespaldoInfo[] = [];

  for (const archivo of archivos) {
    if (archivo.endsWith(".sql") || archivo.endsWith(".dump")) {
      const ruta = join(dir, archivo);
      try {
        const stats = statSync(ruta);
        respaldos.push({
          nombre: archivo,
          ruta,
          tamanoBytes: stats.size,
          fechaCreacion: stats.mtime.toISOString(),
        });
      } catch {
        // archivo inaccesible
      }
    }
  }

  // Ordenar los más recientes primero
  return respaldos.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
}

export async function abrirCarpetaRespaldos(): Promise<void> {
  const dir = rutaCarpetaRespaldos();
  await shell.openPath(dir);
}
