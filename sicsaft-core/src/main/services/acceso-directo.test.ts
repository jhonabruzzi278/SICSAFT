import { describe, expect, test } from "vitest";
import {
  contenidoAccesoDirecto,
  NOMBRE_ACCESO_DIRECTO,
} from "./acceso-directo";

describe("contenidoAccesoDirecto (DOC-028 Fase G)", () => {
  test("arma un .url de Windows (INI, CRLF) que abre el CCP de la PC madre", () => {
    expect(contenidoAccesoDirecto("https://192.168.1.20:8767")).toBe(
      "[InternetShortcut]\r\nURL=https://192.168.1.20:8767/\r\n",
    );
    expect(NOMBRE_ACCESO_DIRECTO).toMatch(/\.url$/);
  });

  test.each([
    "https://192.168.1.20:8767\r\nIconFile=C:\\x.ico",
    "http://192.168.1.20:8767",
    "file:///C:/Windows",
  ])("rechaza un origen que no sea https de una sola línea: %s", (origen) => {
    expect(() => contenidoAccesoDirecto(origen)).toThrow(/inválido/);
  });
});
