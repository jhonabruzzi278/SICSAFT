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
// validar tokens) -> core -> cip. Redis queda deliberadamente afuera de este primer scaffold (ver
// aidlc-docs/sicsaft-core/design-artifacts/ARCHITECTURE.md "Redis — riesgo real, sin solución
// perfecta") -- cis/cip van a fallar al arrancar hasta que ese spike se resuelva; se deja así
// a propósito, no se oculta el problema con un mock.
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

    // TODO real, no resuelto en este scaffold: falta Redis embebido antes de que cis/cip puedan
    // arrancar de verdad (rate-limiter, device-registry, cola BullMQ de cip -- ver
    // ARCHITECTURE.md). Se documenta el punto de integración acá mismo en vez de mockear un Redis
    // falso que ocultaría el problema.
    throw new Error(
      "Redis embebido todavía no está resuelto (ver aidlc-docs/sicsaft-core/design-artifacts/" +
        'ARCHITECTURE.md "Redis — riesgo real") -- postgres y keycloak arrancaron bien, cis/core/' +
        "cip quedan pendientes de ese spike antes de poder integrarse acá.",
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
      "redis",
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

// Referencias no usadas todavía en este primer scaffold (cis/core no se integran hasta resolver
// Redis) -- se dejan importadas para que el próximo incremento solo tenga que llamarlas, no
// reescribir la integración desde cero. rutaDistDeSistema/crearNodeBackendService/POSTGRES_CONFIG/
// KEYCLOAK_CONFIG documentan la forma exacta que va a tener esa llamada.
export {
  crearNodeBackendService,
  rutaDistDeSistema,
  POSTGRES_CONFIG,
  KEYCLOAK_CONFIG,
};
