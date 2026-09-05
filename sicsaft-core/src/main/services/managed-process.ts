import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

// Wrapper reusado por los 5 servicios embebidos (Postgres, Keycloak, cis, core, cip — ADR-005
// sacó a Redis del ecosistema) — evita repetir la misma lógica de spawn/log/espera de 5 formas
// ligeramente distintas. Cada
// servicio concreto (ver postgres-service.ts, keycloak-service.ts, node-backend-service.ts)
// extiende o compone esto con su propio comando y su propia forma de detectar "ya está listo"
// (health endpoint HTTP, o un patrón en stdout — cada proceso lo señala distinto).

export interface ManagedProcessOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  // Detecta que el proceso ya está listo para recibir tráfico — no todos los procesos exponen un
  // health-check HTTP (Postgres no lo tiene nativo, se detecta por stdout: "database system is
  // ready to accept connections"), de ahí que esto sea una función genérica, no un endpoint fijo.
  esperarListo: (proceso: ManagedProcess) => Promise<void>;
}

export type EventoProceso = "stdout" | "stderr" | "listo" | "error" | "salio";

// EventEmitter en vez de callbacks sueltos -- permite que ServiceOrchestrator (service-
// orchestrator.ts) escuche 'listo'/'error'/'salio' de los 6 servicios de forma uniforme sin pasar
// un callback distinto a cada constructor.
export class ManagedProcess extends EventEmitter {
  private proceso: ChildProcess | null = null;
  private bufferStdout = "";
  private bufferStderr = "";

  constructor(private readonly opciones: ManagedProcessOptions) {
    super();
  }

  get estaCorriendo(): boolean {
    return this.proceso !== null && this.proceso.exitCode === null;
  }

  async iniciar(): Promise<void> {
    if (this.estaCorriendo) return;

    // Bug real encontrado corriendo `npm run dev` por primera vez (2026-08-27): spawn() de
    // Windows no puede ejecutar un .bat/.cmd directo (kc.bat, ver keycloak-service.ts) -- no es
    // un PE ejecutable, Windows necesita cmd.exe de por medio para interpretarlo. Sin esto tira
    // "spawn EINVAL" apenas intenta arrancar Keycloak. postgres.exe/node.exe (los otros 4
    // servicios) son PE reales, no lo necesitan -- shell:true solo cuando hace falta, no
    // siempre (evita el riesgo de escaping de shell:true global con args que vengan de fuera).
    //
    // Bug real encontrado instalando el .exe en la ruta por defecto (2026-09-03): con `shell:true`
    // Node corre `cmd /d /s /c "<command> <args>"` y NO quotea el command -- si el command tiene un
    // espacio (el caso real: instalado en `%LOCALAPPDATA%\Programs\SICSAFT CORE\...\kc.bat`) cmd lo
    // corta en el primer espacio y tira "'C:\...\SICSAFT' no se reconoce como un comando". Se
    // quotea el command; cmd (/d /s /c) descarta el primer y ultimo `"` y ejecuta el resto tal
    // cual. Los args de este proyecto (`start --optimized`) no traen espacios; todo lo que si
    // podria traerlos (JAVA_HOME, rutas de datos) viaja por `env`, no por la linea de comandos.
    const nombreComando = this.opciones.command.toLowerCase();
    const necesitaShell =
      nombreComando.endsWith(".bat") || nombreComando.endsWith(".cmd");
    const comando = necesitaShell
      ? `"${this.opciones.command}"`
      : this.opciones.command;

    this.proceso = spawn(comando, this.opciones.args, {
      cwd: this.opciones.cwd,
      env: this.opciones.env,
      // "pipe" (no "inherit") -- capturamos stdout/stderr acá para poder detectar el patrón de
      // "listo" (Postgres) y para poder mostrarlos en una consola de diagnóstico dentro de la app
      // (ver ARCHITECTURE.md CORE-RNF-02, "nunca una ventana en blanco sin feedback") en vez de
      // que se pierdan en la consola del proceso principal, que el vendedor nunca ve.
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: necesitaShell,
    });

    this.proceso.stdout?.on("data", (chunk: Buffer) => {
      this.bufferStdout += chunk.toString("utf8");
      this.emit("stdout", chunk.toString("utf8"));
    });
    this.proceso.stderr?.on("data", (chunk: Buffer) => {
      this.bufferStderr += chunk.toString("utf8");
      this.emit("stderr", chunk.toString("utf8"));
    });
    this.proceso.on("exit", (code, signal) => {
      this.emit("salio", { code, signal });
    });
    this.proceso.on("error", (err) => {
      this.emit("error", err);
    });

    try {
      await this.opciones.esperarListo(this);
      this.emit("listo");
    } catch (err) {
      this.emit("error", err);
      throw err;
    }
  }

  // Usado por implementaciones de esperarListo() que detectan "listo" leyendo stdout acumulado
  // (ej. Postgres) en vez de golpear un endpoint HTTP.
  get stdoutAcumulado(): string {
    return this.bufferStdout;
  }

  get stderrAcumulado(): string {
    return this.bufferStderr;
  }

  async detener(): Promise<void> {
    if (!this.proceso || !this.estaCorriendo) return;
    // SIGTERM primero (permite un shutdown limpio -- importante para Postgres, que puede corromper
    // datos con un kill duro a mitad de un write) -- SIGKILL como fallback si no responde.
    this.proceso.kill("SIGTERM");
    await new Promise<void>((resolvePromise) => {
      const timeout = setTimeout(() => {
        this.proceso?.kill("SIGKILL");
        resolvePromise();
      }, 10_000);
      this.proceso?.once("exit", () => {
        clearTimeout(timeout);
        resolvePromise();
      });
    });
  }
}

// Poll genérico contra una función de chequeo (ej. un fetch a /health) -- usado por
// keycloak-service.ts y node-backend-service.ts (ambos exponen HTTP), no por postgres-service.ts
// (que no tiene un health-check HTTP nativo, ver PostgresService.esperarListo).
export async function esperarCondicion(
  chequeo: () => Promise<boolean>,
  opciones: { intervaloMs: number; maxIntentos: number; nombre: string },
): Promise<void> {
  for (let intento = 0; intento < opciones.maxIntentos; intento += 1) {
    try {
      if (await chequeo()) return;
    } catch {
      // Falla de red esperable mientras el proceso todavía no acepta conexiones -- se reintenta.
    }
    await new Promise((r) => setTimeout(r, opciones.intervaloMs));
  }
  throw new Error(
    `${opciones.nombre} no quedó listo después de ${opciones.maxIntentos} intentos (${(opciones.maxIntentos * opciones.intervaloMs) / 1000}s)`,
  );
}
