import { describe, expect, test, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// vi.mock() se hoistea arriba de los imports -- vi.hoisted() para referenciar el mock dentro del
// factory sin pisar la TDZ (mismo patrón que postgres-bootstrap.test.ts).
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

// Import DESPUÉS del vi.mock para que ManagedProcess tome el spawn mockeado.
const { ManagedProcess } = await import("./managed-process");

type ProcesoFalso = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  exitCode: number | null;
  pid: number | undefined;
  kill: ReturnType<typeof vi.fn>;
  /** Simula que el SO terminó el proceso: fija exitCode y emite 'exit'. */
  morir: () => void;
};

function procesoFalso(pid: number | undefined): ProcesoFalso {
  const ee = new EventEmitter() as ProcesoFalso;
  ee.stdout = new EventEmitter();
  ee.stderr = new EventEmitter();
  ee.exitCode = null;
  ee.pid = pid;
  ee.morir = () => {
    ee.exitCode = 0;
    ee.emit("exit", 0, null);
  };
  ee.kill = vi.fn(() => {
    ee.morir();
    return true;
  });
  return ee;
}

/** Corre `fn` con `process.platform` forzado (no es escribible por defecto). */
async function conPlataforma(
  plataforma: NodeJS.Platform,
  fn: () => Promise<void>,
): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", {
    value: plataforma,
    configurable: true,
  });
  try {
    await fn();
  } finally {
    if (original) Object.defineProperty(process, "platform", original);
  }
}

describe("ManagedProcess.iniciar -- spawn de comandos con espacios en la ruta", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => procesoFalso(4242));
  });

  test("un .bat con espacios en la ruta se quotea y va con shell:true", async () => {
    const command =
      "C:\\Users\\jonat\\AppData\\Local\\Programs\\SICSAFT CORE\\resources\\keycloak\\bin\\kc.bat";
    const proc = new ManagedProcess({
      command,
      args: ["start", "--optimized"],
      esperarListo: () => Promise.resolve(),
    });
    await proc.iniciar();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [comandoUsado, argsUsados, opciones] = spawnMock.mock.calls[0];
    expect(comandoUsado).toBe(`"${command}"`);
    expect(argsUsados).toEqual(["start", "--optimized"]);
    expect(opciones.shell).toBe(true);
  });

  test("un .exe se pasa tal cual, sin quotear y con shell:false", async () => {
    const command =
      "C:\\Users\\jonat\\AppData\\Local\\Programs\\SICSAFT CORE\\resources\\postgres\\bin\\postgres.exe";
    const proc = new ManagedProcess({
      command,
      args: ["-D", "C:\\ruta con espacios\\postgres-data"],
      esperarListo: () => Promise.resolve(),
    });
    await proc.iniciar();

    const [comandoUsado, , opciones] = spawnMock.mock.calls[0];
    expect(comandoUsado).toBe(command);
    expect(opciones.shell).toBe(false);
  });

  test(".CMD (mayúsculas) también se trata como batch", async () => {
    const command = "C:\\a b\\algo.CMD";
    const proc = new ManagedProcess({
      command,
      args: [],
      esperarListo: () => Promise.resolve(),
    });
    await proc.iniciar();

    const [comandoUsado, , opciones] = spawnMock.mock.calls[0];
    expect(comandoUsado).toBe(`"${command}"`);
    expect(opciones.shell).toBe(true);
  });
});

// Bug real reportado tras la primera entrega: al cerrar la app quedaba vivo el `java.exe` de
// Keycloak (nieto del `cmd.exe` que `kc.bat` mete de por medio) con el puerto 58080 tomado, y el
// SEGUNDO arranque de la app fallaba. `child.kill()` en Windows no toca a los descendientes.
describe("ManagedProcess.detener -- baja el árbol de procesos en Windows", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  async function procesoIniciado(pid: number | undefined): Promise<{
    proc: InstanceType<typeof ManagedProcess>;
    falso: ProcesoFalso;
    matarArbol: ReturnType<typeof vi.fn>;
  }> {
    const falso = procesoFalso(pid);
    spawnMock.mockImplementation(() => falso);
    const matarArbol = vi.fn(async (_pid: number) => {
      falso.morir();
    });
    const proc = new ManagedProcess({
      command: "C:\\a b\\kc.bat",
      args: ["start"],
      esperarListo: () => Promise.resolve(),
      matarArbol,
    });
    await proc.iniciar();
    return { proc, falso, matarArbol };
  }

  test("en win32 mata el ÁRBOL por pid (no sólo el hijo directo)", async () => {
    await conPlataforma("win32", async () => {
      const { proc, falso, matarArbol } = await procesoIniciado(1234);
      await proc.detener();
      expect(matarArbol).toHaveBeenCalledWith(1234);
      // El árbol ya bajó -> no hace falta el kill directo, que no alcanzaría al nieto.
      expect(falso.kill).not.toHaveBeenCalled();
    });
  });

  test("en win32 resuelve aunque el proceso muera DURANTE el taskkill (sin esperar el timeout)", async () => {
    await conPlataforma("win32", async () => {
      const { proc } = await procesoIniciado(4242);
      // Si el listener de 'exit' se registrara después de matar, esto colgaría 10s.
      await expect(proc.detener()).resolves.toBeUndefined();
    });
  });

  test("en POSIX mantiene el SIGTERM ordenado (Postgres lo aprovecha) y no usa taskkill", async () => {
    await conPlataforma("linux", async () => {
      const { proc, falso, matarArbol } = await procesoIniciado(4242);
      await proc.detener();
      expect(matarArbol).not.toHaveBeenCalled();
      expect(falso.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });

  test("sin pid conocido cae al kill directo en vez de romper", async () => {
    await conPlataforma("win32", async () => {
      const { proc, falso, matarArbol } = await procesoIniciado(undefined);
      await proc.detener();
      expect(matarArbol).not.toHaveBeenCalled();
      expect(falso.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });

  test("un proceso ya muerto no dispara ningún kill", async () => {
    await conPlataforma("win32", async () => {
      const { proc, falso, matarArbol } = await procesoIniciado(4242);
      falso.morir();
      await proc.detener();
      expect(matarArbol).not.toHaveBeenCalled();
      expect(falso.kill).not.toHaveBeenCalled();
    });
  });
});
