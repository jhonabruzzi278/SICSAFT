import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ConexionGuardada {
  ip: string;
  puertoCcp: number;
  fingerprint: string;
  nombre: string;
}
function rutaArchivo(): string {
  return join(app.getPath("userData"), "conexion.json");
}

export function leerConexionGuardada(): ConexionGuardada | null {
  try {
    const ruta = rutaArchivo();
    if (!existsSync(ruta)) return null;
    const datos: unknown = JSON.parse(readFileSync(ruta, "utf-8"));
    if (
      typeof datos !== "object" ||
      datos === null ||
      typeof (datos as Partial<ConexionGuardada>).ip !== "string" ||
      typeof (datos as Partial<ConexionGuardada>).puertoCcp !== "number"
    )
      return null;
    return datos as ConexionGuardada;
  } catch {
    return null;
  }
}

export function guardarConexion(conexion: ConexionGuardada): void {
  try {
    writeFileSync(rutaArchivo(), JSON.stringify(conexion, null, 2), "utf-8");
  } catch {
    /* Diagnóstico no crítico. */
  }
}
