// Canales IPC de diagnóstico y respaldo: estado de servicios, consola de logs, y gestión de
// respaldos de emergencia de la BPI. Sin dependencias entre sí más allá del ServiceOrchestrator.

import { clipboard, ipcMain, shell } from "electron";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import { obtenerBuffer, rutaCarpetaLog } from "../services/logger";
import {
  abrirCarpetaRespaldos,
  crearRespaldoBpi,
  listarRespaldos,
} from "../services/backup-service";
// TEMPORAL — banco de pruebas, ver reset-bpi-dev.ts
import { vaciarBpiDev } from "../services/reset-bpi-dev";

export function registrarHandlersDiagnostico(
  orquestador: ServiceOrchestrator,
): void {
  ipcMain.handle("sicsaft-core:getEstadoServicios", () =>
    orquestador.getEstado(),
  );

  // Log unificado (src/main/services/logger.ts) -- la Consola técnica del renderer pide el
  // snapshot al abrirse y recibe las líneas nuevas por el push `sicsaft-core:logLinea` (que
  // engancha src/main/index.ts). `abrirCarpetaLog` abre en el explorador la carpeta con los .log
  // del día para adjuntarlos a un correo de soporte.
  ipcMain.handle("sicsaft-core:obtenerLog", (): string[] => obtenerBuffer());
  ipcMain.handle("sicsaft-core:abrirCarpetaLog", async (): Promise<void> => {
    await shell.openPath(rutaCarpetaLog());
  });
  ipcMain.handle(
    "sicsaft-core:copiarAlPortapapeles",
    (_event, texto: string): void => {
      clipboard.writeText(String(texto));
    },
  );

  // Respaldo de emergencia y gestión de copias de seguridad de la Base Patrimonial (BPI)
  ipcMain.handle("sicsaft-core:crearRespaldoBpi", async () => {
    return crearRespaldoBpi();
  });
  ipcMain.handle("sicsaft-core:listarRespaldos", () => {
    return listarRespaldos();
  });
  ipcMain.handle(
    "sicsaft-core:abrirCarpetaRespaldos",
    async (): Promise<void> => {
      await abrirCarpetaRespaldos();
    },
  );

  // TEMPORAL — vaciado de la BPI para el banco de pruebas. El servicio se niega a correr si la
  // app está empaquetada, así que este handler es inofensivo en un cliente instalado; el botón
  // del renderer además solo se dibuja en dev. Ver reset-bpi-dev.ts para eliminarlo.
  ipcMain.handle("sicsaft-core:vaciarBpiDev", async () => {
    return vaciarBpiDev();
  });
}
