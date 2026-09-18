import { app } from "electron";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function rutaLogDeHoy(): string {
  const dir = join(app.getPath("userData"), "logs");
  mkdirSync(dir, { recursive: true });
  return join(dir, `ccp-desktop-${new Date().toISOString().slice(0, 10)}.log`);
}

export function registrar(origen: string, mensaje: string): void {
  const linea = `${new Date().toISOString()} [${origen}] ${mensaje}`;
  console.log(linea);
  try {
    appendFileSync(rutaLogDeHoy(), `${linea}\n`, "utf-8");
  } catch {
    /* Log no crítico. */
  }
}
