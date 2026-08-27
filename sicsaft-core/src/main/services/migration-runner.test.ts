import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.mock() se hoistea arriba de los imports -- una const normal referenciada dentro del factory
// todavía no está inicializada en ese punto (TDZ). vi.hoisted() es el escape hatch documentado de
// vitest para este caso exacto.
const { spawnSyncMock } = vi.hoisted(() => ({ spawnSyncMock: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: spawnSyncMock }));
vi.mock("./node-backend-service", () => ({
  rutaDistDeSistema: (sistema: string) => `/repo/${sistema}/dist/main.js`,
}));

import { correrMigraciones } from "./migration-runner";

describe("correrMigraciones", () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  test("corre scripts/migrate.js up con el Node embebido, apuntando al script correcto", () => {
    spawnSyncMock.mockReturnValue({ status: 0, stdout: "", stderr: "" });

    correrMigraciones({ sistema: "core", env: { CORE_DB_HOST: "127.0.0.1" } });

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    const [comando, args, opciones] = spawnSyncMock.mock.calls[0] as [
      string,
      string[],
      { env: NodeJS.ProcessEnv; cwd: string },
    ];
    expect(comando).toBe(process.execPath);
    expect(args).toEqual(["/repo/core/scripts/migrate.js", "up"]);
    // cwd = la raíz de core/ -- node-pg-migrate resuelve `dir: 'migrations'` (ruta relativa,
    // core/scripts/migrate.js) contra el cwd del proceso hijo, no contra dónde vive el script.
    // Bug real sin esto: escaneaba sicsaft-core/migrations/ (no existe) en vez de core/migrations/.
    expect(opciones.cwd).toBe("/repo/core");
    expect(opciones.env.ELECTRON_RUN_AS_NODE).toBe("1");
    expect(opciones.env.CORE_DB_HOST).toBe("127.0.0.1");
  });

  test("tira un error con el detalle real si la migración falla", () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "relation ya existe",
    });

    expect(() => correrMigraciones({ sistema: "cip", env: {} })).toThrow(
      /cip.*relation ya existe/s,
    );
  });
});
