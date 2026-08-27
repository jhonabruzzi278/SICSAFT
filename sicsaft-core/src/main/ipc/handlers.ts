import { ipcMain } from "electron";
import type {
  AltaDirectorInput,
  AltaDirectorResultado,
  BootstrapClienteResultado,
  DatosClienteInput,
} from "@shared/ipc-contract";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import {
  bootstrapPrimeraInstalacion,
  crearUsuarioDirector,
} from "../keycloak-bootstrap";
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
      // cis recién puede arrancar acá -- necesita el client "cis-admin" (KEYCLOAK_ADMIN_CLIENT_ID/
      // SECRET) que bootstrapPrimeraInstalacion() acaba de crear, ver la nota de secuencia en
      // service-orchestrator.ts iniciarCis(). El wizard espera a que quede "listo" antes de
      // avanzar al siguiente paso (alta del Director, que si necesita cis arriba en el futuro
      // pasaría a llamarlo directo -- hoy altaDirector todavía no depende de cis, ver más abajo).
      await orquestador.iniciarCis(resultado.adminCis);
      return { organizacionId: resultado.organizacionId };
    },
  );

  ipcMain.handle(
    "sicsaft-core:altaDirector",
    async (
      _event,
      input: AltaDirectorInput,
    ): Promise<AltaDirectorResultado> => {
      const admin = orquestador.getKeycloakAdmin();
      return crearUsuarioDirector(admin, input.organizacionId, input.email);
    },
  );
}
