// Canales IPC de la ingesta contable (DOC-029 RF-B): elegir/leer la carpeta vigilada y mantener
// el watcher (ingesta-watcher.ts) sincronizado con instalacion.json. Cachea en memoria el
// client_secret de `sicsaft-ingesta` (no se persiste, ver resolverCredencialesClienteIngesta).

import { dialog, ipcMain, type BrowserWindow } from "electron";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import type { AdminBootstrapKeycloak } from "../services/keycloak-service";
import { obtenerTokenClientCredentials } from "../keycloak-admin-api";
import { resolverCredencialesClienteIngesta } from "../keycloak-ingesta";
import { reconfigurarWatcherIngesta } from "../services/ingesta-watcher";
import {
  actualizarCarpetaIngestaInstalacion,
  leerInstalacionExistente,
} from "../services/instalacion-marker";

// DOC-029 RF-B.6.2 -- credenciales del service account `sicsaft-ingesta` para el watcher de
// ingesta. El secret no se persiste (mismo criterio que cis-admin, ver
// resolverCredencialesClienteIngesta): se recupera de Keycloak la primera vez que hace falta y se
// cachea en memoria del proceso. `null` = todavía no se resolvió.
let credencialesIngesta: { clientId: string; secret: string } | null = null;

async function tokenServicioIngesta(
  admin: AdminBootstrapKeycloak,
): Promise<string> {
  credencialesIngesta ??= await resolverCredencialesClienteIngesta(admin);
  try {
    return await obtenerTokenClientCredentials(
      credencialesIngesta.clientId,
      credencialesIngesta.secret,
    );
  } catch {
    // El secret cacheado pudo quedar viejo (rotación manual desde la consola de Keycloak) --
    // reintentar una vez con credenciales frescas antes de dar el token por perdido.
    credencialesIngesta = await resolverCredencialesClienteIngesta(admin);
    return obtenerTokenClientCredentials(
      credencialesIngesta.clientId,
      credencialesIngesta.secret,
    );
  }
}

export interface HandlersIngesta {
  asegurarWatcherIngesta: () => Promise<void>;
}

export function registrarHandlersIngesta(
  orquestador: ServiceOrchestrator,
  ventana: BrowserWindow,
): HandlersIngesta {
  // Arranca (o reinicia, o apaga) el watcher de la carpeta de ingesta según el estado actual de
  // instalacion.json. Se llama tras cada punto donde `carpetaIngesta` o los servicios pueden
  // haber cambiado: fin del bootstrap, relanzamiento con wizard salteado, y cuando el usuario
  // elige otra carpeta desde el wizard. El watcher es una comodidad de fondo -- si no arranca
  // (Keycloak lento, carpeta borrada) se loguea y el `.exe` sigue: la carga manual de CSV desde el
  // CCP es el camino alternativo permanente (DOC-029 B.6 "no se unifica la carga manual bajo
  // staging").
  async function asegurarWatcherIngesta(): Promise<void> {
    try {
      const instalacion = leerInstalacionExistente();
      const carpeta = instalacion?.carpetaIngesta;
      const organizacionId = instalacion?.organizacionId;
      if (!carpeta || !organizacionId) {
        await reconfigurarWatcherIngesta(null);
        return;
      }
      const admin = orquestador.getKeycloakAdmin();
      await reconfigurarWatcherIngesta({
        carpeta,
        organizacionId,
        obtenerToken: () => tokenServicioIngesta(admin),
      });
    } catch (err: unknown) {
      console.error(
        "[sicsaft-core] No se pudo iniciar el watcher de ingesta contable:",
        err,
      );
    }
  }

  // DOC-029 RF-B.6 -- carpeta vigilada de ingesta de Excel. El diálogo nativo es modal a la
  // ventana del wizard; si el usuario elige una carpeta, se persiste en instalacion.json y el
  // próximo arranque de servidores la inyecta a `ccp` (VITE_SICSAFT_CARPETA_INGESTA). El watcher
  // que corre el ETL Python por cada .xls nuevo vive en el proceso principal (ingesta-watcher.ts)
  // -- este handler solo fija la ruta.
  ipcMain.handle(
    "sicsaft-core:elegirCarpetaIngesta",
    async (): Promise<string | null> => {
      const resultado = await dialog.showOpenDialog(ventana, {
        title: "Carpeta donde el especialista contable deja los Excel",
        properties: ["openDirectory", "createDirectory"],
      });
      if (resultado.canceled || resultado.filePaths.length === 0) return null;
      const carpeta = resultado.filePaths[0];
      actualizarCarpetaIngestaInstalacion(carpeta);
      // DOC-029 RF-B.6.2 -- reapuntar el watcher a la carpeta nueva sin reiniciar la app.
      await asegurarWatcherIngesta();
      return carpeta;
    },
  );

  ipcMain.handle(
    "sicsaft-core:leerCarpetaIngesta",
    (): string | null => leerInstalacionExistente()?.carpetaIngesta ?? null,
  );

  return { asegurarWatcherIngesta };
}
