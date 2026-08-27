import { describe, expect, test } from "vitest";
import { slugificar } from "./slugificar";

describe("slugificar", () => {
  test("convierte a minúsculas y reemplaza espacios por guiones", () => {
    expect(slugificar("Municipalidad de Melipilla")).toBe(
      "municipalidad-de-melipilla",
    );
  });

  test("quita acentos y diacríticos", () => {
    expect(slugificar("Peñalolén")).toBe("penalolen");
  });

  test("colapsa símbolos repetidos en un solo guión", () => {
    expect(slugificar("Cliente!!  ---  Prueba")).toBe("cliente-prueba");
  });

  test("nunca deja un guión al inicio o al final", () => {
    expect(slugificar("  -Cliente-  ")).toBe("cliente");
  });

  test("devuelve string vacío si no queda nada alfanumérico", () => {
    expect(slugificar("!!!")).toBe("");
  });
});
