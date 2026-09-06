import { mkdirSync } from "node:fs";
import { aislar, DIR_DATOS } from "./scripts/appdata";
import { barrerHuerfanos } from "./scripts/exe-process";

// Corre UNA vez para toda la corrida (los dos projects -- `principal` y `ciclo-vida` -- comparten
// los datos que deja el wizard). Aísla `%APPDATA%\sicsaft-core` para no pisar la instalación del
// desarrollador; global-teardown lo restaura. El `.exe` lo lanza cada fixture/spec con
// `_electron.launch`, no acá.
export default async function globalSetup(): Promise<void> {
  await barrerHuerfanos(); // por si una corrida anterior murió sin limpiar
  aislar();
  mkdirSync(DIR_DATOS, { recursive: true });
  console.log("[e2e] %APPDATA%\\sicsaft-core aislado para la corrida");
}
