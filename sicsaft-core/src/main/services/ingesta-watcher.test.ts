import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// `electron` no existe en el entorno de vitest (node puro) -- ingesta-watcher.ts lo importa solo
// para `app.isPackaged` en resolverRutasEtl(). Stub mínimo: no empaquetado (rama de dev).
vi.mock("electron", () => ({ app: { isPackaged: false } }));

import {
  construirEjecucionEtl,
  IngestaWatcher,
  procesarArchivoIngesta,
  type EjecucionEtl,
} from "./ingesta-watcher";

const FECHA_FIJA = new Date("2026-09-02T15:04:05.000Z");

async function carpetaTemporal(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ingesta-test-"));
}

describe("construirEjecucionEtl", () => {
  const base = {
    archivo: "C:\\ingesta\\activos.xls",
    organizacionId: "muni-x",
    token: "jwt-abc",
    ejecutablePython: "python",
    rutaScript: "C:\\repo\\herramientas\\etl-contable\\etl_contable.py",
  };

  test("arma los args en el orden del contrato de DOC-029 B.6.2, sin --mapeo si no se pasa", () => {
    const ej = construirEjecucionEtl(base);
    expect(ej.args).toEqual([
      base.rutaScript,
      "--entrada",
      "C:\\ingesta\\activos.xls",
      "--organizacion",
      "muni-x",
      "--cis-url",
      "http://127.0.0.1:56000",
      "--token",
      "jwt-abc",
    ]);
    expect(ej.args).not.toContain("--mapeo");
    expect(ej.rutaAbsoluta).toBe(false);
  });

  test("agrega --mapeo y respeta un cis-url explícito; marca rutaAbsoluta con ruta absoluta", () => {
    const ej = construirEjecucionEtl({
      ...base,
      ejecutablePython: "C:\\recursos\\etl-contable\\python\\python.exe",
      cisUrl: "http://127.0.0.1:9999",
      rutaMapeo: "C:\\cfg\\mapeo-muni-x.json",
    });
    expect(ej.args.slice(-4)).toEqual([
      "--token",
      "jwt-abc",
      "--mapeo",
      "C:\\cfg\\mapeo-muni-x.json",
    ]);
    expect(ej.args).toContain("http://127.0.0.1:9999");
    expect(ej.rutaAbsoluta).toBe(true);
  });
});

describe("procesarArchivoIngesta", () => {
  let carpeta: string;
  const ejecucion: EjecucionEtl = {
    ejecutable: "python",
    args: ["etl.py"],
    rutaAbsoluta: false,
  };

  beforeEach(async () => {
    carpeta = await carpetaTemporal();
  });
  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  test("ETL ok -> mueve a .procesados/ y deja una línea OK en ingesta.log", async () => {
    const archivo = join(carpeta, "activos.xls");
    await writeFile(archivo, "contenido");

    const resultado = await procesarArchivoIngesta(
      ejecucion,
      { archivo, carpeta },
      {
        ejecutar: vi
          .fn()
          .mockResolvedValue({ stdout: '{"loteId":"l-1"}', stderr: "" }),
        ahora: () => FECHA_FIJA,
      },
    );

    expect(resultado).toBe("procesado");
    const procesados = await readdir(join(carpeta, ".procesados"));
    expect(procesados).toHaveLength(1);
    expect(procesados[0]).toContain("activos.xls");
    const log = await readFile(join(carpeta, "ingesta.log"), "utf-8");
    expect(log).toContain("OK   activos.xls");
    expect(log).toContain('{"loteId":"l-1"}');
    // el original ya no está en la raíz
    expect(await readdir(carpeta)).not.toContain("activos.xls");
  });

  test("ETL falla -> mueve a .error/, escribe el stderr al lado y registra ERR", async () => {
    const archivo = join(carpeta, "roto.xlsx");
    await writeFile(archivo, "contenido");

    const resultado = await procesarArchivoIngesta(
      ejecucion,
      { archivo, carpeta },
      {
        ejecutar: vi.fn().mockRejectedValue({
          stderr: "CIS respondió 422: fila 3 sin código",
        }),
        ahora: () => FECHA_FIJA,
      },
    );

    expect(resultado).toBe("error");
    const errores = await readdir(join(carpeta, ".error"));
    expect(errores.some((f) => f.includes("roto.xlsx"))).toBe(true);
    const logDetalle = errores.find((f) => f.endsWith(".log"));
    expect(logDetalle).toBeDefined();
    const detalle = await readFile(
      join(carpeta, ".error", logDetalle as string),
      "utf-8",
    );
    expect(detalle).toContain("CIS respondió 422");
    const log = await readFile(join(carpeta, "ingesta.log"), "utf-8");
    expect(log).toContain(
      "ERR  roto.xlsx  CIS respondió 422: fila 3 sin código",
    );
  });

  test("no re-tira si el ETL rechaza sin stderr (usa message)", async () => {
    const archivo = join(carpeta, "x.xls");
    await writeFile(archivo, "c");
    const resultado = await procesarArchivoIngesta(
      ejecucion,
      { archivo, carpeta },
      { ejecutar: vi.fn().mockRejectedValue(new Error("ETIMEDOUT")) },
    );
    expect(resultado).toBe("error");
    const log = await readFile(join(carpeta, "ingesta.log"), "utf-8");
    expect(log).toContain("ERR  x.xls  ETIMEDOUT");
  });
});

describe("IngestaWatcher", () => {
  let carpeta: string;

  beforeEach(async () => {
    carpeta = await carpetaTemporal();
  });
  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true });
  });

  test("procesa un .xls nuevo, pide token una vez y lo deja en .procesados/", async () => {
    const obtenerToken = vi.fn().mockResolvedValue("jwt-1");
    const ejecutar = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "" });
    const watcher = new IngestaWatcher(
      {
        carpeta,
        organizacionId: "muni-x",
        obtenerToken,
        esperaEscrituraMs: 40,
      },
      ejecutar,
    );
    await watcher.iniciar();

    await writeFile(join(carpeta, "nuevo.xls"), "datos");

    await vi.waitFor(
      async () => {
        const procesados = await readdir(join(carpeta, ".procesados"));
        expect(procesados.some((f) => f.includes("nuevo.xls"))).toBe(true);
      },
      { timeout: 3000, interval: 50 },
    );

    expect(obtenerToken).toHaveBeenCalledTimes(1);
    const [ejecucion] = ejecutar.mock.calls[0] as [EjecucionEtl];
    expect(ejecucion.args).toContain("--token");
    expect(ejecucion.args).toContain("jwt-1");
    expect(ejecucion.args).toContain("muni-x");

    await watcher.detener();
  });

  test("ignora archivos que no son .xls/.xlsx y las subcarpetas .procesados/.error", async () => {
    const ejecutar = vi.fn().mockResolvedValue({ stdout: "ok", stderr: "" });
    const watcher = new IngestaWatcher(
      {
        carpeta,
        organizacionId: "o",
        obtenerToken: vi.fn().mockResolvedValue("t"),
        esperaEscrituraMs: 40,
      },
      ejecutar,
    );
    await watcher.iniciar();

    await writeFile(join(carpeta, "notas.txt"), "x");
    await writeFile(join(carpeta, ".procesados", "viejo.xls"), "x");

    await new Promise((r) => setTimeout(r, 300));
    expect(ejecutar).not.toHaveBeenCalled();

    await watcher.detener();
  });
});
