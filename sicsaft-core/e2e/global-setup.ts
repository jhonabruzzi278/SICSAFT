import { aislar } from "./scripts/appdata";
import { mkdirSync } from "node:fs";
import { DIR_DATOS } from "./scripts/appdata";

// Aísla `%APPDATA%\sicsaft-core` UNA vez para toda la corrida (los dos projects -- `principal` y
// `ciclo-vida` -- comparten los datos que deja el wizard). global-teardown lo restaura.
export default function globalSetup(): void {
  aislar();
  mkdirSync(DIR_DATOS, { recursive: true });
  console.log(`[e2e] %APPDATA%\\sicsaft-core aislado para la corrida`);
}
