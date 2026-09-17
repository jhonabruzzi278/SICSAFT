import type { BrowserWindow } from "electron";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import { registrarHandlersDiagnostico } from "./handlers-diagnostico";
import { registrarHandlersIpLan } from "./handlers-ip-lan";
import { registrarHandlersPortales } from "./handlers-portales";
import { registrarHandlersIngesta } from "./handlers-ingesta";
import { registrarHandlersInstalacion } from "./handlers-instalacion";

// Todos los handlers reciben el ServiceOrchestrator ya arrancado -- ningún handler expone
// secretos al renderer (el admin de Keycloak, el client secret de cis-admin) más allá de lo que
// cada respuesta necesita explícitamente (ver comentario en shared/ipc-contract.ts sobre por qué
// el renderer nunca ve esos valores directo).
// --
// Cada dominio de canales IPC vive en su propio archivo `ipc/handlers-<dominio>.ts` -- diagnóstico
// y respaldos, IP de LAN, portales embebidos/APP QR, ingesta contable, e instalación/wizard. Este
// archivo solo los registra en orden y conecta las dependencias entre dominios (instalación
// necesita poder asegurar los portales y el watcher de ingesta ya arrancados).
export function registrarIpcHandlers(
  orquestador: ServiceOrchestrator,
  ventana: BrowserWindow,
): void {
  registrarHandlersDiagnostico(orquestador);
  registrarHandlersIpLan(orquestador);
  const { asegurarServidoresPortales } = registrarHandlersPortales(ventana);
  const { asegurarWatcherIngesta } = registrarHandlersIngesta(
    orquestador,
    ventana,
  );
  registrarHandlersInstalacion(orquestador, {
    asegurarServidoresPortales,
    asegurarWatcherIngesta,
  });
}
