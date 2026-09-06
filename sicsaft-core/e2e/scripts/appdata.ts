// Aísla el directorio de datos del `.exe` (`%APPDATA%\sicsaft-core`) mientras corre el harness:
// lo mueve a un lado antes de la corrida y lo restaura al terminar, para no pisar la instalación
// real del desarrollador. Si algo deja el proceso a medias, `restaurar()` es idempotente y el
// backup queda en disco con marca de tiempo.
import { existsSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const RAIZ_APPDATA =
  process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
export const DIR_DATOS = join(RAIZ_APPDATA, "sicsaft-core");
const DIR_BACKUP = join(RAIZ_APPDATA, "sicsaft-core.e2e-playwright-backup");

/**
 * Mueve `%APPDATA%\sicsaft-core` a un backup y deja el lugar vacío para que el `.exe` arranque
 * con el wizard desde cero. Si ya había un `DIR_BACKUP` de una corrida anterior que murió sin
 * limpiar, PRIMERO lo restaura (ese backup son los datos reales del dev; lo que está hoy en
 * `DIR_DATOS` es la instalación de laboratorio a medias) -- así nunca se pierde la instalación
 * real del desarrollador.
 */
export function aislar(): void {
  if (existsSync(DIR_BACKUP)) {
    restaurar();
  }
  if (existsSync(DIR_DATOS)) {
    renameSync(DIR_DATOS, DIR_BACKUP);
  }
}

/** Borra los datos de la corrida y restaura el backup del desarrollador (si había). */
export function restaurar(): void {
  if (existsSync(DIR_DATOS)) {
    rmSync(DIR_DATOS, { recursive: true, force: true });
  }
  if (existsSync(DIR_BACKUP)) {
    renameSync(DIR_BACKUP, DIR_DATOS);
  }
}

/** Carpeta de logs del día del `.exe` (uno por fecha). */
export function rutaCarpetaLogs(): string {
  return join(DIR_DATOS, "logs");
}
