import { describe, expect, it } from "vitest";
import {
  agruparParaEtiquetas,
  SIN_AREA,
  SIN_DEPARTAMENTO,
  SIN_DIRECCION,
} from "./etiquetas";
import type { FilaEtl } from "@shared/ipc-contract";

function fila(over: Partial<FilaEtl>): FilaEtl {
  return {
    linea: 1,
    codigoPatrimonial: "DG-001",
    codigoQr: "DG-001",
    ...over,
  };
}

describe("agruparParaEtiquetas", () => {
  it("agrupa por dirección y, dentro, por departamento y área — directo desde la fila del ETL", () => {
    const filas = [
      fila({
        linea: 1,
        codigoQr: "AD-002",
        direccionNombre: "Administración",
        departamentoNombre: "Finanzas",
        areaNombre: "Contabilidad",
      }),
      fila({
        linea: 2,
        codigoQr: "AD-001",
        direccionNombre: "Administración",
        departamentoNombre: "Finanzas",
        areaNombre: "Contabilidad",
      }),
      fila({
        linea: 3,
        codigoQr: "TE-001",
        direccionNombre: "Administración",
        departamentoNombre: "Personas",
        areaNombre: "RRHH",
      }),
      fila({
        linea: 4,
        codigoQr: "IN-001",
        direccionNombre: "Infraestructura",
        areaNombre: "Obras",
      }),
    ];

    const grupos = agruparParaEtiquetas(filas);

    expect(grupos.map((g) => g.direccion)).toEqual([
      "Administración",
      "Infraestructura",
    ]);
    const admin = grupos[0];
    expect(admin.total).toBe(3);
    expect(admin.departamentos.map((d) => d.departamento)).toEqual([
      "Finanzas",
      "Personas",
    ]);
    // Dentro del departamento, ordenado por codigoQr (numeric-aware).
    expect(
      admin.departamentos[0].areas[0].activos.map((a) => a.codigoQr),
    ).toEqual(["AD-001", "AD-002"]);

    const infra = grupos[1];
    expect(infra.departamentos.map((d) => d.departamento)).toEqual([
      SIN_DEPARTAMENTO,
    ]);
  });

  it('manda las filas sin dirección/departamento/área a los grupos "Sin …"', () => {
    const filas = [fila({ linea: 1, codigoQr: "X-1" })];

    const grupos = agruparParaEtiquetas(filas);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].direccion).toBe(SIN_DIRECCION);
    expect(grupos[0].departamentos[0].departamento).toBe(SIN_DEPARTAMENTO);
    expect(grupos[0].departamentos[0].areas[0].areaNombre).toBe(SIN_AREA);
  });

  it("usa nombreAft cuando está, y cae a codigoQr si no vino en el Excel", () => {
    const filas = [
      fila({ linea: 1, codigoQr: "A-1", nombreAft: "Notebook Dell" }),
      fila({ linea: 2, codigoQr: "A-2" }),
    ];

    const [grupo] = agruparParaEtiquetas(filas);
    const activos = grupo.departamentos[0].areas[0].activos;

    expect(activos.find((a) => a.codigoQr === "A-1")?.nombre).toBe(
      "Notebook Dell",
    );
    expect(activos.find((a) => a.codigoQr === "A-2")?.nombre).toBe("A-2");
  });

  it("devuelve lista vacía sin filas", () => {
    expect(agruparParaEtiquetas([])).toEqual([]);
  });
});
