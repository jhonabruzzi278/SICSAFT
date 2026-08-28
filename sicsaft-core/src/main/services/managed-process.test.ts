import { describe, expect, test, vi } from "vitest";
import { esperarCondicion } from "./managed-process";

describe("esperarCondicion", () => {
  test("resuelve apenas el chequeo devuelve true", async () => {
    const chequeo = vi.fn().mockResolvedValue(true);
    await expect(
      esperarCondicion(chequeo, {
        intervaloMs: 1,
        maxIntentos: 5,
        nombre: "test",
      }),
    ).resolves.toBeUndefined();
    expect(chequeo).toHaveBeenCalledTimes(1);
  });

  test("reintenta hasta que el chequeo devuelve true", async () => {
    const chequeo = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    await esperarCondicion(chequeo, {
      intervaloMs: 1,
      maxIntentos: 5,
      nombre: "test",
    });
    expect(chequeo).toHaveBeenCalledTimes(3);
  });

  test("tolera que el chequeo tire una excepción y sigue reintentando", async () => {
    const chequeo = vi
      .fn()
      .mockRejectedValueOnce(new Error("conexión rechazada"))
      .mockResolvedValueOnce(true);
    await esperarCondicion(chequeo, {
      intervaloMs: 1,
      maxIntentos: 5,
      nombre: "test",
    });
    expect(chequeo).toHaveBeenCalledTimes(2);
  });

  test("tira un error claro si se agotan los intentos", async () => {
    const chequeo = vi.fn().mockResolvedValue(false);
    await expect(
      esperarCondicion(chequeo, {
        intervaloMs: 1,
        maxIntentos: 3,
        nombre: "keycloak",
      }),
    ).rejects.toThrow(/keycloak no quedó listo después de 3 intentos/);
    expect(chequeo).toHaveBeenCalledTimes(3);
  });
});
