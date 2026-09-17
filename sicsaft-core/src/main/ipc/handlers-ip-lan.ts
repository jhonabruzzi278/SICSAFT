// Canales IPC de reconfiguración de IP de LAN (DOC-028 Fase C.1): el wizard los llama al detectar
// que la IP de esta PC cambió desde la instalación (DHCP que reasigna).

import { ipcMain } from "electron";
import type { EstadoIpLan } from "@shared/ipc-contract";
import type { ServiceOrchestrator } from "../services/service-orchestrator";
import type { AdminBootstrapKeycloak } from "../services/keycloak-service";
import {
  reconfigurarClientAppQr,
  sincronizarOrigenesClientCcp,
} from "../keycloak-clients";
import {
  obtenerIpLan,
  obtenerOrigenAppQr,
  obtenerOrigenCcpLan,
} from "../services/lan-ip";
import {
  actualizarIpLanInstalacion,
  leerInstalacionExistente,
} from "../services/instalacion-marker";
import { evaluarCambioIpLan } from "../services/ip-lan-guard";

// DOC-028 Fase G -- el client OIDC `ccp` tiene que aceptar volver al origen de LAN actual. Se
// corre en cada relanzamiento (cubre instalaciones anteriores a la Fase G, cuyo client solo tenía
// loopback) y al reconfigurar la IP. No fatal: si falla, el Director y el CCP embebido de esta PC
// siguen andando; lo único que no entra es el puesto del AFT en otra PC, y queda en el log.
export async function sincronizarClientCcpSinFallar(
  admin: AdminBootstrapKeycloak,
): Promise<void> {
  try {
    await sincronizarOrigenesClientCcp(admin, obtenerOrigenCcpLan());
  } catch (err: unknown) {
    console.error(
      "[sicsaft-core] No se pudo registrar en Keycloak el origen de LAN del CCP (puesto del Profesional de AFT):",
      err,
    );
  }
}

export function registrarHandlersIpLan(orquestador: ServiceOrchestrator): void {
  // DOC-028 Fase C.1 -- el wizard llama esto al relanzar, después de getInstalacionExistente(). Si
  // la IP de LAN de la PC cambió desde la instalación, devuelve cambio: true y el wizard muestra
  // PasoIpCambio antes del login. Backfill: una instalación anterior a Fase C no tiene ipLan
  // persistida -- se adopta la IP actual como línea base (no sabemos la vieja, asumir que la de
  // ahora está bien).
  ipcMain.handle("sicsaft-core:getEstadoIpLan", (): EstadoIpLan => {
    const estado = evaluarCambioIpLan();
    if (estado.ipGuardada === null && leerInstalacionExistente()) {
      actualizarIpLanInstalacion(estado.ipActual);
    }
    return estado;
  });

  // DOC-028 Fase C.1 -- reconfiguración de ~1 clic: re-registra el redirectUri/webOrigins del
  // client OIDC de la APP QR en Keycloak con la IP nueva y reescribe la ipLan del marcador.
  // Devuelve el estado ya reevaluado (cambio === false si salió bien).
  ipcMain.handle(
    "sicsaft-core:reconfigurarIpLan",
    async (): Promise<EstadoIpLan> => {
      const admin = orquestador.getKeycloakAdmin();
      await reconfigurarClientAppQr(admin, obtenerOrigenAppQr());
      await sincronizarClientCcpSinFallar(admin);
      actualizarIpLanInstalacion(obtenerIpLan());
      return evaluarCambioIpLan();
    },
  );
}
