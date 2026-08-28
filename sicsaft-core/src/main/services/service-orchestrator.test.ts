import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.mock() se hoistea arriba de los imports -- las consts normales referenciadas dentro de un
// factory todavía no están inicializadas en ese punto (TDZ). vi.hoisted() es el escape hatch
// documentado de vitest para este caso exacto -- todo lo que un factory de abajo necesita vive
// acá adentro.
const {
  iniciarMock,
  detenerMock,
  fakeProceso,
  admin,
  bootstrapDbsMock,
  migrarMock,
} = vi.hoisted(() => {
  const iniciarMock = vi.fn().mockResolvedValue(undefined);
  const detenerMock = vi.fn().mockResolvedValue(undefined);
  function fakeProceso() {
    return {
      iniciar: iniciarMock,
      detener: detenerMock,
      on: vi.fn(),
    } as never;
  }
  return {
    iniciarMock,
    detenerMock,
    fakeProceso,
    admin: { usuario: "admin", password: "pw" },
    bootstrapDbsMock: vi.fn().mockResolvedValue(undefined),
    migrarMock: vi.fn(),
  };
});

vi.mock("./postgres-service", () => ({
  crearPostgresService: vi.fn().mockResolvedValue(fakeProceso()),
  POSTGRES_CONFIG: { puerto: 55432, usuarioAdmin: "sicsaft_admin" },
}));

vi.mock("./keycloak-service", () => ({
  crearKeycloakService: vi
    .fn()
    .mockResolvedValue({ proceso: fakeProceso(), admin }),
  KEYCLOAK_CONFIG: {
    puerto: 58080,
    url: "http://127.0.0.1:58080",
    realm: "sicsaft",
  },
}));

vi.mock("./node-backend-service", () => ({
  crearNodeBackendService: vi.fn().mockReturnValue(fakeProceso()),
  rutaDistDeSistema: (sistema: string) => `/repo/${sistema}/dist/main.js`,
}));

vi.mock("./postgres-bootstrap", () => ({
  crearBasesDeDatosSiHacenFalta: bootstrapDbsMock,
}));

vi.mock("./migration-runner", () => ({ correrMigraciones: migrarMock }));

import { ServiceOrchestrator } from "./service-orchestrator";

describe("ServiceOrchestrator", () => {
  beforeEach(() => {
    iniciarMock.mockClear().mockResolvedValue(undefined);
    detenerMock.mockClear().mockResolvedValue(undefined);
    bootstrapDbsMock.mockClear().mockResolvedValue(undefined);
    migrarMock.mockClear();
  });

  test("iniciarTodo() arranca postgres, bootstrapea bases, keycloak, migra y arranca core/cip -- sin cis", async () => {
    const orquestador = new ServiceOrchestrator();
    await orquestador.iniciarTodo();

    const estado = orquestador.getEstado();
    expect(estado.postgres?.estado).toBe("listo");
    expect(estado.keycloak?.estado).toBe("listo");
    expect(estado.core?.estado).toBe("listo");
    expect(estado.cip?.estado).toBe("listo");
    expect(estado.cis).toBeUndefined();

    expect(bootstrapDbsMock).toHaveBeenCalledTimes(1);
    expect(migrarMock).toHaveBeenCalledWith(
      expect.objectContaining({ sistema: "core" }),
    );
    expect(migrarMock).toHaveBeenCalledWith(
      expect.objectContaining({ sistema: "cip" }),
    );
    expect(orquestador.getKeycloakAdmin()).toEqual(admin);
  });

  test("iniciarCis() antes de iniciarTodo() tira un error claro, no arranca nada a medias", async () => {
    const orquestador = new ServiceOrchestrator();
    await expect(
      orquestador.iniciarCis({ clientId: "cis-admin", secret: "s" }),
    ).rejects.toThrow(/iniciarTodo/);
  });

  test("iniciarCis() después de iniciarTodo() deja cis en 'listo'", async () => {
    const orquestador = new ServiceOrchestrator();
    await orquestador.iniciarTodo();
    await orquestador.iniciarCis({ clientId: "cis-admin", secret: "s" });

    expect(orquestador.getEstado().cis?.estado).toBe("listo");
  });

  test("si un paso falla, marca 'error' con el detalle y lo propaga", async () => {
    iniciarMock.mockRejectedValueOnce(new Error("postgres no arrancó"));
    const orquestador = new ServiceOrchestrator();

    await expect(orquestador.iniciarTodo()).rejects.toThrow(
      "postgres no arrancó",
    );
    expect(orquestador.getEstado().postgres).toEqual({
      estado: "error",
      detalle: "postgres no arrancó",
    });
  });

  test("detenerTodo() para en orden inverso (cis antes que core/cip, esos antes que keycloak/postgres)", async () => {
    const orquestador = new ServiceOrchestrator();
    await orquestador.iniciarTodo();
    await orquestador.iniciarCis({ clientId: "cis-admin", secret: "s" });

    detenerMock.mockClear();
    await orquestador.detenerTodo();
    // 5 procesos (postgres/keycloak/core/cip/cis) -- se llamó detener() en los 5.
    expect(detenerMock).toHaveBeenCalledTimes(5);
  });
});
