import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
} from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, irARuta } from "../fixtures/portales";
import { capturar } from "../fixtures/capturas";
import { consultar, unaFila } from "../scripts/db";
import { DIR_DATOS } from "../scripts/appdata";
import { ORG, URLS } from "../test-data";

// DOC-029 RF-B -- ingesta de Excel contable de punta a punta contra el `.exe` real:
//   1. el vendedor elige la carpeta vigilada (diálogo nativo -> se stubea en el proceso principal)
//   2. el especialista contable deja un .xls/.xlsx ahí
//   3. el watcher del `.exe` corre el ETL Python vendorizado -> POST a CIS -> CORE deja un lote
//      `pendiente_revision` SIN tocar la BPI
//   4. el Profesional de AFT revisa el lote en el CCP y lo aprueba -> recién ahí los activos
//      entran a la Base Patrimonial, bajo su identidad
//   5. un Excel malformado va a `.error/` con su `.log`, sin crear lote
//
// Corre última en el project `principal` (número 18) para no interferir con el resto: deja
// configurada una `carpetaIngesta` en instalacion.json y un watcher activo. La carpeta vive DENTRO
// del `%APPDATA%` aislado -> global-teardown la borra con el resto.

const AQUI = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(AQUI, "..", "fixtures");
const CARPETA_INGESTA = join(DIR_DATOS, "e2e-ingesta");
const CODIGOS = ["E2E-001", "E2E-002", "E2E-003", "E2E-004"];

async function esperar<T>(
  fn: () => Promise<T | null | undefined>,
  { timeoutMs = 120_000, intervaloMs = 3_000 } = {},
): Promise<T | null> {
  const fin = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fin) return null;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
}

// Deja un archivo en la carpeta vigilada de forma atómica: copia a un dot-file (ignorado por
// chokidar) y lo renombra al nombre final -> el `add` dispara sobre un archivo ya completo.
function soltar(origen: string, nombreDestino: string): void {
  const tmp = join(CARPETA_INGESTA, `.tmp-${nombreDestino}`);
  copyFileSync(origen, tmp);
  renameSync(tmp, join(CARPETA_INGESTA, nombreDestino));
}

function leerSiHay(ruta: string): string {
  return existsSync(ruta) ? readFileSync(ruta, "utf8") : "";
}

function diagnostico(): string {
  const errDir = join(CARPETA_INGESTA, ".error");
  const sidecars = existsSync(errDir)
    ? readdirSync(errDir)
        .filter((f) => f.endsWith(".log"))
        .map((f) => `--- ${f} ---\n${readFileSync(join(errDir, f), "utf8")}`)
        .join("\n")
    : "(sin .error/)";
  return `ingesta.log:\n${leerSiHay(join(CARPETA_INGESTA, "ingesta.log")) || "(vacío)"}\n\n${sidecars}`;
}

test.describe.configure({ mode: "serial" });

test.describe("18 - Ingesta de Excel contable (DOC-029 RF-B)", () => {
  test("elegir la carpeta de ingesta (diálogo nativo) la persiste y arranca el watcher", async ({
    exe,
  }, testInfo) => {
    mkdirSync(CARPETA_INGESTA, { recursive: true });

    // El diálogo nativo de carpeta no lo maneja Playwright -> se stubea `dialog.showOpenDialog`
    // en el proceso principal para que devuelva la carpeta de la corrida (patrón estándar de
    // Electron + Playwright). `handlers.ts` lo llama por property-access, así que el stub aplica.
    await exe.app.evaluate(({ dialog }, carpeta) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [carpeta],
      })) as typeof dialog.showOpenDialog;
    }, CARPETA_INGESTA);

    const elegida = await exe.page.evaluate(() =>
      window.sicsaftCore.elegirCarpetaIngesta(),
    );
    expect(elegida).toBe(CARPETA_INGESTA);

    const leida = await exe.page.evaluate(() =>
      window.sicsaftCore.leerCarpetaIngesta(),
    );
    expect(leida).toBe(CARPETA_INGESTA);

    // El watcher crea sus subcarpetas al arrancar (ingesta-watcher.ts iniciar()).
    await esperar(
      async () => existsSync(join(CARPETA_INGESTA, ".procesados")) || null,
      { timeoutMs: 15_000, intervaloMs: 1_000 },
    );
    expect(existsSync(join(CARPETA_INGESTA, ".procesados"))).toBe(true);
    expect(existsSync(join(CARPETA_INGESTA, ".error"))).toBe(true);

    await capturar(exe.page, testInfo, "shell-carpeta-ingesta-elegida");
  });

  test("un .xlsx en la carpeta → el ETL corre y CORE deja un lote 'pendiente_revision'", async ({
    aft,
  }) => {
    soltar(
      join(FIXTURES, "activos-contable-e2e.xlsx"),
      "activos-contable-e2e.xlsx",
    );

    const lote = await esperar(async () => {
      const r = await aft.api.get(
        `/admin/importaciones/contable/lote?organizacionId=${ORG.id}`,
      );
      if (!r.ok()) return null;
      const lotes = (await r.json()) as Array<{
        id: string;
        estado: string;
        archivoNombre: string | null;
      }>;
      return (
        lotes.find((l) => l.archivoNombre === "activos-contable-e2e.xlsx") ??
        null
      );
    });
    expect(
      lote,
      `el ETL no dejó un lote en 120s.\n${diagnostico()}`,
    ).toBeTruthy();
    expect(lote!.estado).toBe("pendiente_revision");
    process.env.E2E_LOTE_ID = lote!.id;

    // Filas del lote: los 4 códigos del Excel, con el dry-run resuelto a "crear" (BPI limpia).
    const rd = await aft.api.get(
      `/admin/importaciones/contable/lote/${lote!.id}`,
    );
    expect(rd.ok()).toBeTruthy();
    const { filas } = (await rd.json()) as {
      filas: Array<{
        codigoPatrimonial: string;
        dryRunResultado: string | null;
      }>;
    };
    expect(filas.map((f) => f.codigoPatrimonial).sort()).toEqual(CODIGOS);
    expect(filas.every((f) => f.dryRunResultado === "crear")).toBe(true);

    // El archivo se movió a `.procesados/` y quedó una línea OK en `ingesta.log`.
    const movido = await esperar(
      async () =>
        readdirSync(join(CARPETA_INGESTA, ".procesados")).some((f) =>
          f.endsWith("activos-contable-e2e.xlsx"),
        ) || null,
      { timeoutMs: 20_000, intervaloMs: 1_000 },
    );
    expect(
      movido,
      `el archivo no llegó a .procesados/.\n${diagnostico()}`,
    ).toBe(true);
    expect(readFileSync(join(CARPETA_INGESTA, "ingesta.log"), "utf8")).toMatch(
      /OK\s+activos-contable-e2e\.xlsx/,
    );
  });

  test("el Profesional de AFT revisa el lote en el CCP y lo aprueba → los activos entran a la BPI", async ({
    aft,
  }, testInfo) => {
    const loteId = process.env.E2E_LOTE_ID;
    test.skip(!loteId, "no hay lote de la ingesta (test anterior falló)");

    await irARuta(
      aft.page,
      `${URLS.ccp}/importaciones?organizacionId=${ORG.id}`,
    );
    await expect(aft.page).not.toHaveURL(/\/login$/);
    await expect(
      aft.page.getByRole("heading", { name: /importaciones controladas/i }),
    ).toBeVisible();

    const filaLote = aft.page.getByText("activos-contable-e2e.xlsx").first();
    await expect(filaLote).toBeVisible({ timeout: 15_000 });
    await capturar(aft.page, testInfo, "ccp-importaciones-lote-pendiente");

    await filaLote.click();
    await expect(aft.page.getByText("E2E-001")).toBeVisible({
      timeout: 10_000,
    });
    await capturar(aft.page, testInfo, "ccp-importaciones-detalle-filas");

    await aft.page
      .getByRole("button", { name: /aprobar e incorporar/i })
      .click();
    await expect(aft.page.getByText(/lote aprobado:/i)).toBeVisible({
      timeout: 30_000,
    });
    await capturar(aft.page, testInfo, "ccp-importaciones-lote-aprobado");

    // BPI: los 4 activos del Excel quedaron, en estado activo.
    const activos = await consultar<{
      codigo_patrimonial: string;
      estado: string;
    }>(
      "core",
      `select codigo_patrimonial, estado
         from activos
        where organizacion_id=$1 and codigo_patrimonial = any($2::text[])
        order by codigo_patrimonial`,
      [ORG.id, CODIGOS],
    );
    expect(activos.map((a) => a.codigo_patrimonial)).toEqual(CODIGOS);
    expect(activos.every((a) => a.estado === "activo")).toBe(true);

    // El lote quedó en `aprobado`, con revisor registrado (la identidad real del AFT).
    const lote = await unaFila<{ estado: string; revisado_por: string | null }>(
      "core",
      "select estado, revisado_por from importacion_contable_lote where id=$1",
      [loteId],
    );
    expect(lote?.estado).toBe("aprobado");
    expect(lote?.revisado_por).toBeTruthy();
  });

  test("un Excel malformado va a `.error/` con su `.log` y NO crea lote", async ({
    aft,
  }) => {
    const contar = async (): Promise<number> => {
      const r = await aft.api.get(
        `/admin/importaciones/contable/lote?organizacionId=${ORG.id}`,
      );
      return ((await r.json()) as unknown[]).length;
    };
    const nAntes = await contar();

    soltar(join(FIXTURES, "activos-contable-malformado.xlsx"), "roto.xlsx");

    const enError = await esperar(
      async () => {
        const dir = join(CARPETA_INGESTA, ".error");
        if (!existsSync(dir)) return null;
        const f = readdirSync(dir);
        return f.some((x) => x.endsWith("roto.xlsx")) &&
          f.some((x) => x.endsWith("roto.xlsx.log"))
          ? f
          : null;
      },
      { timeoutMs: 90_000 },
    );
    expect(
      enError,
      `el Excel malformado no terminó en .error/ con su .log.\n${diagnostico()}`,
    ).toBeTruthy();

    const sidecar = readdirSync(join(CARPETA_INGESTA, ".error")).find((f) =>
      f.endsWith("roto.xlsx.log"),
    )!;
    const detalle = readFileSync(
      join(CARPETA_INGESTA, ".error", sidecar),
      "utf8",
    );
    expect(detalle).toMatch(/encabezado|CODIGO|ValueError|Error/i);
    expect(readFileSync(join(CARPETA_INGESTA, "ingesta.log"), "utf8")).toMatch(
      /ERR\s+roto\.xlsx/,
    );

    // No se creó un lote nuevo por el archivo roto.
    expect(await contar()).toBe(nAntes);
  });

  // Opt-in: el Excel real del cliente por el MISMO pipeline. Se salta salvo que
  // SICSAFT_INGESTA_XLSX apunte a un .xls/.xlsx real -- así el usuario puede probar su archivo
  // sin tocar el harness: `SICSAFT_INGESTA_XLSX="C:\ruta\a\su.xlsx" npm run e2e`.
  test("(opcional) un Excel real del cliente pasa por el mismo pipeline", async ({
    aft,
  }) => {
    const ruta = process.env.SICSAFT_INGESTA_XLSX;
    test.skip(
      !ruta || !existsSync(ruta),
      "definí SICSAFT_INGESTA_XLSX con la ruta de un .xls/.xlsx real para probarlo",
    );

    const nombre = `real-${Date.now().toString(36)}${extname(ruta!)}`;
    soltar(ruta!, nombre);

    const lote = await esperar(async () => {
      const r = await aft.api.get(
        `/admin/importaciones/contable/lote?organizacionId=${ORG.id}`,
      );
      if (!r.ok()) return null;
      const lotes = (await r.json()) as Array<{
        id: string;
        estado: string;
        archivoNombre: string | null;
      }>;
      return lotes.find((l) => l.archivoNombre === nombre) ?? null;
    });
    expect(
      lote,
      `el Excel real no produjo un lote en 120s. Si las columnas no coinciden con el mapeo por ` +
        `defecto (CODIGO/DIRECCION/AREA/RESPONSABLE/CATEGORIA/...), hace falta un ` +
        `mapeo-<org>.json.\n${diagnostico()}`,
    ).toBeTruthy();
    expect(lote!.estado).toBe("pendiente_revision");

    const rd = await aft.api.get(
      `/admin/importaciones/contable/lote/${lote!.id}`,
    );
    expect(rd.ok()).toBeTruthy();
    const { filas } = (await rd.json()) as { filas: unknown[] };
    expect(filas.length).toBeGreaterThan(0);
  });
});
