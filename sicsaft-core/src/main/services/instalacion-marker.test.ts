import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// instalacion-marker.ts resuelve la ruta del marcador con app.getPath("userData") de Electron --
// acá lo apuntamos a un directorio temporal real y se ejercita el round-trip de fs de verdad
// (no se mockea fs).
const { userDataDir } = vi.hoisted(() => ({ userDataDir: { ruta: "" } }));
vi.mock("electron", () => ({
  app: { getPath: () => userDataDir.ruta },
}));

import {
  actualizarCarpetaIngestaInstalacion,
  actualizarIpLanInstalacion,
  leerInstalacionExistente,
  marcarInstalacionCompleta,
} from "./instalacion-marker";

function rutaMarcador(): string {
  return join(userDataDir.ruta, "instalacion.json");
}

describe("instalacion-marker", () => {
  beforeEach(() => {
    userDataDir.ruta = mkdtempSync(join(tmpdir(), "sicsaft-marker-"));
  });
  afterEach(() => {
    rmSync(userDataDir.ruta, { recursive: true, force: true });
  });

  test("leerInstalacionExistente devuelve null si no hay marcador", () => {
    expect(leerInstalacionExistente()).toBeNull();
  });

  test("marcarInstalacionCompleta persiste organizacionId/clienteNombre/ipLan", () => {
    marcarInstalacionCompleta({
      organizacionId: "muni-x",
      clienteNombre: "Municipalidad X",
      ipLan: "192.168.1.11",
    });

    expect(leerInstalacionExistente()).toEqual({
      organizacionId: "muni-x",
      clienteNombre: "Municipalidad X",
      ipLan: "192.168.1.11",
    });
  });

  // DOC-030 -- el `nivel` deja de estar horneado en `1`; el wizard lo elige (PasoDatosCliente) y
  // el bootstrap lo pasa tal cual. asegurarServidoresPortales() lo lee de acá para servir el CCP
  // (completo en ambos niveles) con o sin el Dashboard/CIP -- Nivel 2 = Nivel 1 + Dashboard.
  test.each([1, 2] as const)(
    "marcarInstalacionCompleta persiste nivel %i tal cual",
    (nivel) => {
      marcarInstalacionCompleta({
        organizacionId: "muni-x",
        clienteNombre: "Municipalidad X",
        ipLan: "192.168.1.11",
        nivel,
      });

      expect(leerInstalacionExistente()?.nivel).toBe(nivel);
    },
  );

  test("actualizarIpLanInstalacion reescribe solo la ipLan, deja el resto intacto", () => {
    marcarInstalacionCompleta({
      organizacionId: "muni-x",
      clienteNombre: "Municipalidad X",
      ipLan: "192.168.1.11",
    });

    actualizarIpLanInstalacion("192.168.1.8");

    expect(leerInstalacionExistente()).toEqual({
      organizacionId: "muni-x",
      clienteNombre: "Municipalidad X",
      ipLan: "192.168.1.8",
    });
  });

  test("actualizarIpLanInstalacion agrega ipLan a un marcador anterior a Fase C (sin ese campo)", () => {
    // Marcador viejo escrito a mano, sin ipLan.
    writeFileSync(
      rutaMarcador(),
      JSON.stringify({ organizacionId: "muni-x", clienteNombre: "Muni X" }),
    );

    actualizarIpLanInstalacion("10.0.0.5");

    const guardado = JSON.parse(
      readFileSync(rutaMarcador(), "utf-8"),
    ) as Record<string, unknown>;
    expect(guardado).toEqual({
      organizacionId: "muni-x",
      clienteNombre: "Muni X",
      ipLan: "10.0.0.5",
    });
  });

  test("actualizarIpLanInstalacion tira si no hay instalación previa", () => {
    expect(() => actualizarIpLanInstalacion("10.0.0.5")).toThrow(
      /sin instalación previa/,
    );
  });

  test("actualizarCarpetaIngestaInstalacion reescribe solo la carpetaIngesta, deja el resto intacto", () => {
    marcarInstalacionCompleta({
      organizacionId: "muni-x",
      clienteNombre: "Municipalidad X",
      ipLan: "192.168.1.11",
      nivel: 1,
    });

    actualizarCarpetaIngestaInstalacion("D:\\SICSAFT\\ingesta");

    expect(leerInstalacionExistente()).toEqual({
      organizacionId: "muni-x",
      clienteNombre: "Municipalidad X",
      ipLan: "192.168.1.11",
      nivel: 1,
      carpetaIngesta: "D:\\SICSAFT\\ingesta",
    });
  });

  test("actualizarCarpetaIngestaInstalacion tira si no hay instalación previa", () => {
    expect(() =>
      actualizarCarpetaIngestaInstalacion("D:\\SICSAFT\\ingesta"),
    ).toThrow(/sin instalación previa/);
  });
});
