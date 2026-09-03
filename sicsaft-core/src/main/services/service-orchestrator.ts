import { EventEmitter } from "node:events";
import type { EstadoServicios, NombreServicio } from "@shared/ipc-contract";
import { ManagedProcess } from "./managed-process";
import { registrar } from "./logger";
import { crearPostgresService, POSTGRES_CONFIG } from "./postgres-service";
import {
  crearKeycloakService,
  KEYCLOAK_CONFIG,
  type AdminBootstrapKeycloak,
} from "./keycloak-service";
import { crearNodeBackendService } from "./node-backend-service";
import { crearBasesDeDatosSiHacenFalta } from "./postgres-bootstrap";
import { correrMigraciones } from "./migration-runner";
import {
  crearConfigCip,
  crearConfigCis,
  crearConfigCore,
  crearEventosOutboxUrl,
  generarTokenServicio,
  type TokensServicio,
} from "./backend-configs";

// Arranca los servicios embebidos EN ORDEN (mismo criterio que
// devops/onprem/docker-compose.yml `depends_on: condition: service_healthy`, pero acá lo maneja
// código propio en vez de Compose): postgres -> (bootstrap de bases) -> keycloak -> core ->
// cip. ADR-005 (2026-08-27) saca a Redis del ecosistema completo -- un servicio menos que embeber.
//
// cis NO arranca acá -- a diferencia de core/cip (que solo necesitan Postgres), cis necesita
// KEYCLOAK_ADMIN_CLIENT_ID/SECRET, que recién existen después de que el wizard corre
// bootstrapPrimeraInstalacion() (keycloak-bootstrap.ts, paso 1 del wizard, "datos del cliente").
// Por eso cis arranca desde `iniciarCis()`, llamado por el handler IPC `bootstrapCliente` (ver
// ipc/handlers.ts) una vez que esas credenciales existen, no desde acá.
//
// Vendorizado real (2026-08-27): Postgres 16.15/JRE 17.0.20.1/Keycloak 26.0.0 en resources/ (ver
// resources/README.md) -- este orquestador ya arranca los 5 servicios de punta a punta, verificado
// real (no solo compilado).
export class ServiceOrchestrator extends EventEmitter {
  private readonly estado: EstadoServicios = {};
  private keycloakAdmin: AdminBootstrapKeycloak | null = null;
  private readonly procesos = new Map<NombreServicio, ManagedProcess>();
  private tokens: TokensServicio | null = null;
  private eventosOutboxUrl: string | null = null;

  getEstado(): EstadoServicios {
    return { ...this.estado };
  }

  private marcar(
    servicio: NombreServicio,
    estado: EstadoServicios[string],
  ): void {
    this.estado[servicio] = estado;
    // Cada transición al log unificado -- si un servicio se queda en "iniciando" o pasa a
    // "error", la Consola técnica del renderer lo muestra sin que nadie tenga que leer stdout.
    const sufijo = estado.detalle ? `: ${estado.detalle}` : "";
    registrar("orquestador", `${servicio} → ${estado.estado}${sufijo}`);
    this.emit("estado-cambio", this.getEstado());
  }

  async iniciarTodo(): Promise<void> {
    await this.iniciar("postgres", crearPostgresService());

    // Entre Postgres listo y Keycloak arrancando -- Keycloak necesita que la base `keycloak` ya
    // exista (Postgres no la autocrea a partir de KC_DB_URL_DATABASE), y core/cip necesitan las
    // suyas para poder migrar. No es un servicio propio que el wizard muestre (ver
    // PasoIniciandoServicios.tsx ETIQUETAS/ORDEN) -- si falla, se propaga igual que cualquier otro
    // paso de iniciarTodo(), el error real llega a index.ts sin ocultarlo.
    await crearBasesDeDatosSiHacenFalta();

    const { proceso: keycloakProceso, admin } = await crearKeycloakService();
    this.keycloakAdmin = admin;
    await this.iniciar("keycloak", Promise.resolve(keycloakProceso));

    this.tokens = {
      coreServiceToken: generarTokenServicio(),
      cipServiceToken: generarTokenServicio(),
    };
    this.eventosOutboxUrl = crearEventosOutboxUrl();

    const configCore = crearConfigCore(this.eventosOutboxUrl, this.tokens);
    correrMigraciones({
      sistema: "core",
      env: {
        CORE_DB_HOST: configCore.env.CORE_DB_HOST,
        CORE_DB_PORT: configCore.env.CORE_DB_PORT,
        CORE_DB_NAME: configCore.env.CORE_DB_NAME,
        CORE_DB_USER: configCore.env.CORE_DB_USER,
        CORE_DB_PASSWORD: configCore.env.CORE_DB_PASSWORD,
      },
    });
    await this.iniciar(
      "core",
      Promise.resolve(crearNodeBackendService(configCore)),
    );

    const configCip = crearConfigCip(this.eventosOutboxUrl, this.tokens);
    correrMigraciones({
      sistema: "cip",
      env: {
        CIP_DB_HOST: configCip.env.CIP_DB_HOST,
        CIP_DB_PORT: configCip.env.CIP_DB_PORT,
        CIP_DB_NAME: configCip.env.CIP_DB_NAME,
        CIP_DB_USER: configCip.env.CIP_DB_USER,
        CIP_DB_PASSWORD: configCip.env.CIP_DB_PASSWORD,
      },
    });
    await this.iniciar(
      "cip",
      Promise.resolve(crearNodeBackendService(configCip)),
    );
  }

  // Llamado por el handler IPC `bootstrapCliente` (ipc/handlers.ts) una vez que
  // bootstrapPrimeraInstalacion() (keycloak-bootstrap.ts) ya creó el client `cis-admin` -- ver la
  // nota de secuencia en iniciarTodo(). Tira si se llama antes de iniciarTodo() (tokens/
  // eventosOutboxUrl todavía null) -- error de programación, no un caso a tolerar en silencio.
  async iniciarCis(adminCis: {
    clientId: string;
    secret: string;
  }): Promise<void> {
    if (!this.tokens) {
      throw new Error(
        "iniciarCis() llamado antes de iniciarTodo() -- core/cip todavía no generaron los " +
          "tokens de servicio que cis necesita.",
      );
    }
    // Idempotente -- iniciarCis() ahora se llama tanto desde bootstrapCliente (primer wizard)
    // como desde getInstalacionExistente (relanzamiento con el wizard salteado, ver
    // instalacion-marker.ts), y React StrictMode en dev puede disparar ese segundo camino dos
    // veces (mismo patrón que ya se resolvió en PasoListoConLogin.tsx yaMostrado). `this.estado`
    // se marca "iniciando" de forma síncrona, antes de cualquier await en iniciar() de más abajo
    // -- por eso es una guarda segura contra la carrera, a diferencia de chequear this.procesos
    // (que recién se llena después de un await).
    const estadoActual = this.estado.cis?.estado;
    if (estadoActual === "iniciando" || estadoActual === "listo") return;
    const configCis = crearConfigCis(this.tokens, adminCis);
    await this.iniciar(
      "cis",
      Promise.resolve(crearNodeBackendService(configCis)),
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
      // stdout/stderr crudos del servicio embebido al log unificado -- se suscribe ANTES de
      // proceso.iniciar() para no perder las primeras líneas (Postgres/Keycloak escupen el motivo
      // del fallo justo al arrancar). logger.redactar() tapa secretos antes de tocar disco.
      proceso.on("stdout", (chunk: string) => registrar(nombre, chunk));
      proceso.on("stderr", (chunk: string) => registrar(nombre, chunk));
      await proceso.iniciar();
      this.marcar(nombre, { estado: "listo" });
    } catch (err: unknown) {
      const detalle = err instanceof Error ? err.message : String(err);
      this.marcar(nombre, { estado: "error", detalle });
      throw err;
    }
  }

  async detenerTodo(): Promise<void> {
    // Orden inverso al de arranque -- cis (si llegó a arrancar) se para antes que core/cip, de
    // los que depende, y esos antes que keycloak/postgres.
    const orden: NombreServicio[] = [
      "cis",
      "cip",
      "core",
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

export { POSTGRES_CONFIG, KEYCLOAK_CONFIG };
