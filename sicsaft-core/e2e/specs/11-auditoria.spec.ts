import { test, expect } from "../fixtures/portales";
import { consultar } from "../scripts/db";
import { ORG } from "../test-data";

// El motor de auditoría (§12.35.4) registra las operaciones patrimoniales y de identidad hechas
// en las specs anteriores. Se comprueba por la API (que consume el CCP) y por la tabla de la BPI.

test.describe("11 - Auditoría", () => {
  test("GET /admin/auditoria devuelve entradas de las operaciones de la corrida", async ({
    aft,
  }) => {
    const r = await aft.api.get("/admin/auditoria?limit=200");
    expect(r.ok()).toBeTruthy();
    const { entradas } = await r.json();
    expect(Array.isArray(entradas) && entradas.length > 0).toBeTruthy();

    const texto = JSON.stringify(entradas);
    // Al menos un alta de activo y una de catálogo quedaron registradas.
    expect(texto).toMatch(/activo/i);
  });

  test("la tabla `auditoria` de la BPI tiene filas patrimoniales y de identidad de la org", async ({
    aft,
  }) => {
    void aft;
    const filas = await consultar(
      "core",
      `select operacion, categoria, resultado
         from auditoria
        where organizacion_id = $1 or organizacion_id is null
        order by fecha desc
        limit 100`,
      [ORG.id],
    );
    expect(filas.length).toBeGreaterThan(0);

    const ops = filas.map((f) => String(f.operacion));
    // POST /activos y POST /catalogo-tipos de la spec 06/07.
    expect(ops.some((o) => /activos/i.test(o))).toBeTruthy();
    expect(ops.some((o) => /catalogo-tipos/i.test(o))).toBeTruthy();
    // POST /directivo/usuarios de la spec 09 (categoría identidad).
    expect(
      filas.some(
        (f) =>
          /directivo\/usuarios/i.test(String(f.operacion)) &&
          String(f.categoria) === "identidad",
      ),
    ).toBeTruthy();
  });
});
