import { restaurar } from "./scripts/appdata";
import { pararExe } from "./scripts/exe-process";

// Cierra el `.exe` de la corrida (cierre de ventana -> before-quit limpio; luego remata el árbol,
// incluido el `java` de Keycloak que el `.exe` deja huérfano en Windows) y restaura
// `%APPDATA%\sicsaft-core` del desarrollador. Con KEEP_APPDATA=1 deja los datos de la corrida.
export default async function globalTeardown(): Promise<void> {
  // Al final de la corrida ya nada necesita los servicios -> kill duro directo (sin el poll de
  // apagado, que abría sockets pg justo cuando el event loop se está cerrando).
  await pararExe({ duro: true });

  if (process.env.KEEP_APPDATA === "1") {
    console.log("[e2e] KEEP_APPDATA=1 -- no restauro %APPDATA%\\sicsaft-core");
    return;
  }
  restaurar();
  console.log("[e2e] .exe cerrado y %APPDATA%\\sicsaft-core restaurado");
}
