import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.mock() se hoistea arriba de los imports -- vi.hoisted() es el escape hatch de vitest para
// referenciar estos mocks dentro del factory de abajo sin pisar la TDZ.
const { queryMock, connectMock, endMock, ClienteFalso } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const connectMock = vi.fn();
  const endMock = vi.fn();
  // Función normal, NO arrow function -- `new Client(...)` necesita invocar esto como
  // constructor, y una arrow function no puede usarse con `new` ("is not a constructor",
  // hallazgo real). Retornar un objeto explícito desde una función normal invocada con `new` SÍ
  // funciona (el `return` gana sobre el `this` implícito).
  function ClienteFalso() {
    return { connect: connectMock, query: queryMock, end: endMock };
  }
  return { queryMock, connectMock, endMock, ClienteFalso };
});

vi.mock("pg", () => ({ Client: ClienteFalso }));

import { crearBasesDeDatosSiHacenFalta } from "./postgres-bootstrap";

describe("crearBasesDeDatosSiHacenFalta", () => {
  beforeEach(() => {
    queryMock.mockReset().mockResolvedValue(undefined);
    connectMock.mockReset().mockResolvedValue(undefined);
    endMock.mockReset().mockResolvedValue(undefined);
  });

  test("crea las 4 bases requeridas (keycloak/core/cip/eventos_outbox)", async () => {
    await crearBasesDeDatosSiHacenFalta();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(4);
    const basesCreadas = queryMock.mock.calls.map(
      (llamada) => llamada[0] as string,
    );
    expect(basesCreadas.some((sql) => sql.includes('"keycloak"'))).toBe(true);
    expect(basesCreadas.some((sql) => sql.includes('"core"'))).toBe(true);
    expect(basesCreadas.some((sql) => sql.includes('"cip"'))).toBe(true);
    expect(basesCreadas.some((sql) => sql.includes('"eventos_outbox"'))).toBe(
      true,
    );
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  test("es idempotente: ignora el error de base ya existente (42P04)", async () => {
    queryMock.mockRejectedValueOnce(
      Object.assign(new Error("ya existe"), { code: "42P04" }),
    );

    await expect(crearBasesDeDatosSiHacenFalta()).resolves.toBeUndefined();
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  test("propaga cualquier otro error real (no lo confunde con idempotencia)", async () => {
    queryMock.mockRejectedValueOnce(
      Object.assign(new Error("conexión rechazada"), { code: "ECONNREFUSED" }),
    );

    await expect(crearBasesDeDatosSiHacenFalta()).rejects.toThrow(
      "conexión rechazada",
    );
    // El cliente igual se cierra -- el finally corre aunque una query falle de verdad.
    expect(endMock).toHaveBeenCalledTimes(1);
  });
});
