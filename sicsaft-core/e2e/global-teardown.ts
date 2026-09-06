import { restaurar } from "./scripts/appdata";
import { barrerHuerfanos } from "./scripts/exe-process";

// Barre cualquier proceso del `.exe` que haya quedado suelto (incluido el `java` de Keycloak que
// el `.exe` deja huérfano en Windows) y restaura `%APPDATA%\sicsaft-core` del desarrollador. Con
// KEEP_APPDATA=1 deja los datos de la corrida.
export default async function globalTeardown(): Promise<void> {
  await barrerHuerfanos();

  if (process.env.KEEP_APPDATA === "1") {
    console.log("[e2e] KEEP_APPDATA=1 -- no restauro %APPDATA%\\sicsaft-core");
    return;
  }
  restaurar();
  console.log("[e2e] %APPDATA%\\sicsaft-core restaurado");
}
