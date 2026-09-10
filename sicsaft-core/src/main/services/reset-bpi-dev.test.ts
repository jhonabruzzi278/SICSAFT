import { describe, expect, it, vi, beforeEach } from "vitest";

// `vi.mock` se iza por encima de las declaraciones del archivo, así que los objetos que usan sus
// factories tienen que crearse con `vi.hoisted` o quedan sin inicializar al evaluarse el mock.
const mocks = vi.hoisted(() => ({
  electronApp: { isPackaged: false, getPath: () => "/tmp" },
  crearRespaldoBpi: vi.fn(),
}));

vi.mock("electron", () => ({
  app: mocks.electronApp,
  shell: { openPath: vi.fn() },
}));
vi.mock("./backup-service", () => ({
  crearRespaldoBpi: mocks.crearRespaldoBpi,
}));
vi.mock("./logger", () => ({ registrar: vi.fn() }));
vi.mock("pg", () => ({ Client: vi.fn() }));

import { bpiVaciableEnEsteEntorno, vaciarBpiDev } from "./reset-bpi-dev";

describe("vaciado de la BPI (herramienta temporal de pruebas)", () => {
  beforeEach(() => {
    mocks.crearRespaldoBpi.mockReset();
  });

  it("está disponible mientras la app corre sin empaquetar", () => {
    mocks.electronApp.isPackaged = false;
    expect(bpiVaciableEnEsteEntorno()).toBe(true);
  });

  it("se niega en la app empaquetada, que es la que llega al cliente", () => {
    mocks.electronApp.isPackaged = true;
    expect(bpiVaciableEnEsteEntorno()).toBe(false);
  });

  it("empaquetada no toca la base ni siquiera para respaldar", async () => {
    mocks.electronApp.isPackaged = true;
    await expect(vaciarBpiDev()).rejects.toThrow(
      /solo está disponible en desarrollo/,
    );
    // Si hubiera seguido, lo primero que haría es el respaldo: que no se llame prueba que cortó
    // antes de abrir ninguna conexión a Postgres.
    expect(mocks.crearRespaldoBpi).not.toHaveBeenCalled();
  });
});
