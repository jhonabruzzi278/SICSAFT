import { mkdirSync } from "node:fs";
import { aislar, DIR_DATOS } from "./scripts/appdata";
import {
  arrancarExe,
  barrerHuerfanos,
  esperarServiciosBase,
} from "./scripts/exe-process";

// Corre UNA vez para toda la corrida (los dos projects -- `principal` y `ciclo-vida` -- comparten
// el `.exe` y los datos que deja el wizard). Aísla `%APPDATA%\sicsaft-core`, arranca el `.exe` con
// el DevTools Protocol abierto y espera a que suban Postgres+Keycloak+CORE+CIP (CIS entra recién
// en el paso 1 del wizard). global-teardown lo cierra y restaura %APPDATA%.
export default async function globalSetup(): Promise<void> {
  await barrerHuerfanos(); // por si una corrida anterior murió sin limpiar
  aislar();
  mkdirSync(DIR_DATOS, { recursive: true });

  const handle = await arrancarExe();
  console.log(
    `[e2e] .exe arrancado (pid ${handle.pid}, CDP :${handle.cdpPort}); esperando servicios base…`,
  );
  await esperarServiciosBase(handle.cdpPort);
  console.log("[e2e] Postgres + Keycloak + CORE + CIP listos");
}
