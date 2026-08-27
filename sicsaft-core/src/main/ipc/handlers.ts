import { ipcMain } from "electron";
import type {
  AltaDirectorInput,
  AltaDirectorResultado,
  BootstrapClienteResultado,
  DatosClienteInput,
} from "@shared/ipc-contract";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import { bootstrapPrimeraInstalacion } from "../keycloak-bootstrap";
import { KEYCLOAK_CONFIG } from "../services/keycloak-service";
import { PUERTO_RENDERER } from "../renderer-config";

// Todos los handlers reciben el ServiceOrchestrator ya arrancado -- ningún handler expone
// secretos al renderer (el admin de Keycloak, el client secret de cis-admin) más allá de lo que
// cada respuesta necesita explícitamente (ver comentario en shared/ipc-contract.ts sobre por qué
// el renderer nunca ve esos valores directo).
export function registrarIpcHandlers(orquestador: ServiceOrchestrator): void {
  ipcMain.handle("sicsaft-core:getEstadoServicios", () =>
    orquestador.getEstado(),
  );

  ipcMain.handle(
    "sicsaft-core:bootstrapCliente",
    async (
      _event,
      input: DatosClienteInput,
    ): Promise<BootstrapClienteResultado> => {
      const admin = orquestador.getKeycloakAdmin();
      const resultado = await bootstrapPrimeraInstalacion(
        admin,
        input.clienteNombre,
        input.organizacionId,
        PUERTO_RENDERER,
      );
      return { organizacionId: resultado.organizacionId };
    },
  );

  ipcMain.handle(
    "sicsaft-core:altaDirector",
    async (
      _event,
      _input: AltaDirectorInput,
    ): Promise<AltaDirectorResultado> => {
      // TODO real: portar KeycloakAdminService.crearUsuarioHuman (cis/src/keycloak-admin/) a este
      // proceso principal -- mismo patrón que keycloak-bootstrap.ts ya hizo con
      // Bootstrap-Keycloak.psm1, pendiente para el siguiente incremento (ADR-005 sacó a Redis del
      // ecosistema, ya no es el bloqueante -- falta el wiring real de cis/ al orquestador, ver
      // service-orchestrator.ts).
      throw new Error(
        `No implementado todavía -- pendiente portar KeycloakAdminService.crearUsuarioHuman ` +
          `(ver cis/src/keycloak-admin/keycloak-admin.service.ts) a ${KEYCLOAK_CONFIG.realm}.`,
      );
    },
  );
}
