import { describe, expect, test, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// vi.mock() se hoistea arriba de los imports -- vi.hoisted() para referenciar el mock dentro del
// factory sin pisar la TDZ (mismo patrón que postgres-bootstrap.test.ts).
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

// Import DESPUÉS del vi.mock para que ManagedProcess tome el spawn mockeado.
const { ManagedProcess } = await import("./managed-process");

function procesoFalso() {
  const ee = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    exitCode: number | null;
  };
  ee.stdout = new EventEmitter();
  ee.stderr = new EventEmitter();
  ee.exitCode = null;
  return ee;
}

describe("ManagedProcess.iniciar -- spawn de comandos con espacios en la ruta", () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => procesoFalso());
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
