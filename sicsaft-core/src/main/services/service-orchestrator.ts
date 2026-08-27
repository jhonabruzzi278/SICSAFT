import { EventEmitter } from "node:events";
import type { EstadoServicios, NombreServicio } from "@shared/ipc-contract";
import { ManagedProcess } from "./managed-process";
import { crearPostgresService, POSTGRES_CONFIG } from "./postgres-service";
import {
  crearKeycloakService,
  KEYCLOAK_CONFIG,
  type AdminBootstrapKeycloak,
} from "./keycloak-service";
import {
  crearNodeBackendService,
  rutaDistDeSistema,
} from "./node-backend-service";

// Arranca los servicios embebidos EN ORDEN (mismo criterio que
// devops/onprem/docker-compose.yml `depends_on: condition: service_healthy`, pero acá lo maneja
// código propio en vez de Compose): postgres -> keycloak -> cis (necesita keycloak arriba para
// validar tokens) -> core -> cip. ADR-005 (2026-08-27) saca a Redis del ecosistema completo
// (rate-limiter/device-registry de cis pasan a memoria del propio proceso, la cola CORE->CIP pasa
// a pg-boss sobre Postgres) -- ya no es un bloqueante para este scaffold, un servicio menos que
// embeber. cis/core/cip siguen sin integrarse acá todavía (ver el `throw` de abajo): falta escribir
// el wiring real (env vars apuntando a postgres/keycloak embebidos, migraciones, la base
// `eventos_outbox` nueva), no un problema de dependencias externas.
export class ServiceOrchestrator extends EventEmitter {
  private readonly estado: EstadoServicios = {};
  private keycloakAdmin: AdminBootstrapKeycloak | null = null;
  private readonly procesos = new Map<NombreServicio, ManagedProcess>();

  getEstado(): EstadoServicios {
    return { ...this.estado };
  }

  private marcar(
    servicio: NombreServicio,
    estado: EstadoServicios[string],
  ): void {
    this.estado[servicio] = estado;
    this.emit("estado-cambio", this.getEstado());
  }

  async iniciarTodo(): Promise<void> {
    await this.iniciar("postgres", crearPostgresService());

    const { proceso: keycloakProceso, admin } = await crearKeycloakService();
    this.keycloakAdmin = admin;
    await this.iniciar("keycloak", Promise.resolve(keycloakProceso));

    // TODO real, no resuelto en este scaffold: cis/core/cip todavía no se integran acá -- falta
    // el wiring real (env vars apuntando a postgres/keycloak embebidos vía POSTGRES_CONFIG/
    // KEYCLOAK_CONFIG de abajo, aplicar migraciones, crear la base `eventos_outbox` nueva de
    // ADR-005). Ya no depende de resolver Redis primero (ver ARCHITECTURE.md "Redis — riesgo
    // real", sección eliminada por ADR-005) -- se documenta el punto de integración acá mismo en
    // vez de mockear un arranque falso que ocultaría que todavía no está hecho.
    throw new Error(
      "cis/core/cip todavía no se integran a este orquestador (próximo paso, ver " +
        "aidlc-docs/sicsaft-core/00_PROJECT_METADATA.md) -- postgres y keycloak arrancaron bien.",
    );
  }

  private async iniciar(
    nombre: NombreServicio,
    procesoPromise: Promise<ManagedProcess>,
  ): Promise<void> {
    this.marcar(nombre, { estado: "iniciando" });
    try {
      const proceso = await procesoPromise;
      this.procesos.set(nombre, proceso);
      await proceso.iniciar();
      this.marcar(nombre, { estado: "listo" });
    } catch (err: unknown) {
      const detalle = err instanceof Error ? err.message : String(err);
      this.marcar(nombre, { estado: "error", detalle });
      throw err;
    }
  }

  async detenerTodo(): Promise<void> {
    // Orden inverso al de arranque -- cis/core/cip (si llegaran a estar arriba) se paran antes que
    // keycloak/postgres, de los que dependen.
    const orden: NombreServicio[] = [
      "cip",
      "core",
      "cis",
      "keycloak",
      "postgres",
    ];
    for (const nombre of orden) {
      const proceso = this.procesos.get(nombre);
      if (proceso) await proceso.detener();
    }
  }

  getKeycloakAdmin(): AdminBootstrapKeycloak {
    if (!this.keycloakAdmin) throw new Error("Keycloak todavía no arrancó");
    return this.keycloakAdmin;
  }
}

// Referencias no usadas todavía en este primer scaffold (cis/core/cip no se integran hasta
// escribir el wiring real, ver el `throw` de arriba) -- se dejan importadas para que el próximo
// incremento solo tenga que llamarlas, no reescribir la integración desde cero.
// rutaDistDeSistema/crearNodeBackendService/POSTGRES_CONFIG/KEYCLOAK_CONFIG documentan la forma
// exacta que va a tener esa llamada.
export {
  crearNodeBackendService,
  rutaDistDeSistema,
  POSTGRES_CONFIG,
  KEYCLOAK_CONFIG,
};
