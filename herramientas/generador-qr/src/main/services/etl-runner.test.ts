import { describe, expect, it, vi } from "vitest";
import {
  construirEjecucionEtl,
  generarEtiquetas,
  resolverRutasEtl,
} from "./etl-runner";

vi.mock("electron", () => ({ app: { isPackaged: false } }));

describe("construirEjecucionEtl", () => {
  it("arma la línea de comandos en modo dry-run (--salida -), sin --cis-url ni --token", () => {
    const ej = construirEjecucionEtl({
      archivo: "C:\\clientes\\activos.xls",
      organizacionId: "muni",
      ejecutablePython: "python",
      rutaScript: "C:\\repo\\herramientas\\etl-contable\\etl_contable.py",
    });

    expect(ej.ejecutable).toBe("python");
    expect(ej.args).toEqual([
      "C:\\repo\\herramientas\\etl-contable\\etl_contable.py",
      "--entrada",
      "C:\\clientes\\activos.xls",
      "--organizacion",
      "muni",
      "--salida",
      "-",
    ]);
    expect(ej.args).not.toContain("--cis-url");
    expect(ej.args).not.toContain("--token");
  });

  it("agrega --mapeo cuando se pasa una ruta", () => {
    const ej = construirEjecucionEtl({
      archivo: "activos.xls",
      organizacionId: "muni",
      rutaMapeo: "mapeo-muni.json",
      ejecutablePython: "python",
      rutaScript: "etl_contable.py",
    });

    expect(ej.args).toEqual([
      "etl_contable.py",
      "--entrada",
      "activos.xls",
      "--organizacion",
      "muni",
      "--salida",
      "-",
      "--mapeo",
      "mapeo-muni.json",
    ]);
  });

  it("marca rutaAbsoluta cuando el ejecutable es una ruta de Windows", () => {
    expect(
      construirEjecucionEtl({
        archivo: "a.xls",
        organizacionId: "muni",
        ejecutablePython: "C:\\python\\python.exe",
        rutaScript: "etl_contable.py",
      }).rutaAbsoluta,
    ).toBe(true);
    expect(
      construirEjecucionEtl({
        archivo: "a.xls",
        organizacionId: "muni",
        ejecutablePython: "python",
        rutaScript: "etl_contable.py",
      }).rutaAbsoluta,
    ).toBe(false);
  });
});

describe("resolverRutasEtl", () => {
  // No se afirma la profundidad exacta del `join(__dirname, "..", "..", "..", ...)`: `__dirname`
  // en el build real de electron-vite refleja `out/main/` (todo el proceso principal queda
  // bundleado en un solo archivo), pero bajo Vitest refleja la ubicación real de este archivo
  // fuente (`src/main/services/`) -- son profundidades distintas a propósito, y este test correría
  // sobre la fuente, no sobre el bundle. La combinación real (python + etl_contable.py contra el
  // fixture de herramientas/etl-contable/tests/) se verificó a mano corriendo el comando real.
  it("en dev apunta a etl_contable.py y resuelve el ejecutable de Python del sistema", () => {
    const { rutaScript, ejecutablePython } = resolverRutasEtl();

    expect(rutaScript.replace(/\\/g, "/")).toMatch(/etl_contable\.py$/);
    expect(ejecutablePython).toBe(
      process.env.SICSAFT_ETL_PYTHON ??
        (process.platform === "win32" ? "python" : "python3"),
    );
  });
});

describe("generarEtiquetas", () => {
  it("parsea el stdout del ETL como el cuerpo JSON canónico", async () => {
    const cuerpo = {
      organizacionId: "muni",
      origen: "carpeta",
      archivoNombre: "activos.xls",
      filas: [
        {
          linea: 1,
          codigoPatrimonial: "DG-001",
          codigoQr: "DG-001",
          direccionNombre: "DIRECCION GENERAL",
          areaNombre: "OFICINA",
          nombreAft: "Notebook",
        },
      ],
    };
    const ejecutar = vi
      .fn()
      .mockResolvedValue({ stdout: JSON.stringify(cuerpo), stderr: "" });

    const resultado = await generarEtiquetas("activos.xls", "muni", undefined, {
      ejecutar,
    });

    expect(resultado).toEqual(cuerpo);
    expect(ejecutar).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(["--entrada", "activos.xls"]),
      }),
    );
  });

  it("relanza el stderr del ETL como mensaje de error legible", async () => {
    const ejecutar = vi.fn().mockRejectedValue({
      stderr: "se necesita --cis-url y --token",
      message: "Command failed",
    });

    await expect(
      generarEtiquetas("activos.xls", "muni", undefined, { ejecutar }),
    ).rejects.toThrow("se necesita --cis-url y --token");
  });

  it("lanza un error claro si el ETL no devuelve JSON válido", async () => {
    const ejecutar = vi
      .fn()
      .mockResolvedValue({ stdout: "no es json", stderr: "" });

    await expect(
      generarEtiquetas("activos.xls", "muni", undefined, { ejecutar }),
    ).rejects.toThrow(/no devolvió un JSON válido/);
  });
});
