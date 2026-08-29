import { describe, expect, test, vi, beforeEach } from "vitest";

const { obtenerIpLanMock, leerInstalacionExistenteMock } = vi.hoisted(() => ({
  obtenerIpLanMock: vi.fn(),
  leerInstalacionExistenteMock: vi.fn(),
}));
vi.mock("./lan-ip", () => ({ obtenerIpLan: obtenerIpLanMock }));
vi.mock("./instalacion-marker", () => ({
  leerInstalacionExistente: leerInstalacionExistenteMock,
}));

import { evaluarCambioIpLan } from "./ip-lan-guard";

describe("evaluarCambioIpLan", () => {
  beforeEach(() => {
    obtenerIpLanMock.mockReset();
    leerInstalacionExistenteMock.mockReset();
  });

  test("cambio: true cuando la IP guardada difiere de la actual", () => {
    obtenerIpLanMock.mockReturnValue("192.168.1.8");
    leerInstalacionExistenteMock.mockReturnValue({
      organizacionId: "muni-x",
      clienteNombre: "Muni X",
      ipLan: "192.168.1.11",
    });

    expect(evaluarCambioIpLan()).toEqual({
      cambio: true,
      ipGuardada: "192.168.1.11",
      ipActual: "192.168.1.8",
    });
  });

  test("cambio: false cuando la IP guardada coincide con la actual", () => {
    obtenerIpLanMock.mockReturnValue("192.168.1.11");
    leerInstalacionExistenteMock.mockReturnValue({
      organizacionId: "muni-x",
      clienteNombre: "Muni X",
      ipLan: "192.168.1.11",
    });

    const estado = evaluarCambioIpLan();
    expect(estado.cambio).toBe(false);
    expect(estado.ipGuardada).toBe("192.168.1.11");
  });

  test("instalación anterior a Fase C (sin ipLan): cambio: false, ipGuardada: null", () => {
    obtenerIpLanMock.mockReturnValue("10.0.0.5");
    leerInstalacionExistenteMock.mockReturnValue({
      organizacionId: "muni-x",
      clienteNombre: "Muni X",
    });

    expect(evaluarCambioIpLan()).toEqual({
      cambio: false,
      ipGuardada: null,
      ipActual: "10.0.0.5",
    });
  });

  test("sin instalación previa: cambio: false, ipGuardada: null", () => {
    obtenerIpLanMock.mockReturnValue("127.0.0.1");
    leerInstalacionExistenteMock.mockReturnValue(null);

    expect(evaluarCambioIpLan()).toEqual({
      cambio: false,
      ipGuardada: null,
      ipActual: "127.0.0.1",
    });
  });
});
