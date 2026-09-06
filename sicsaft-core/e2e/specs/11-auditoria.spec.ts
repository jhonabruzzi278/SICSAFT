import { test, expect } from "../fixtures/portales";
import { consultar } from "../scripts/db";
import { ORG } from "../test-data";

// El motor de auditoría (§12.35.4) registra las operaciones patrimoniales y de identidad hechas
// en las specs anteriores. Se comprueba por la API (que consume el CCP) y por la tabla de la BPI.
// La escritura de auditoría no es necesariamente síncrona con la operación (casos-de-uso/e2e la
// chequea con `expect.soft` por eso) -> acá se hace polling con tope antes de fallar duro.

async function hasta(
  cond: () => Promise<boolean>,
  { timeoutMs = 45_000, intervaloMs = 2_000 } = {},
): Promise<boolean> {
  const fin = Date.now() + timeoutMs;
  for (;;) {
    if (await cond()) return true;
    if (Date.now() > fin) return false;
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
}

test.describe("11 - Auditoría", () => {
  test("GET /admin/auditoria devuelve entradas con referencia a las operaciones de la corrida", async ({
    aft,
  }) => {
    const ok = await hasta(async () => {
      // `limit` tope 100 (paginacionSchema) -- `?limit=200` da 400.
      const r = await aft.api.get("/admin/auditoria?limit=100");
      if (!r.ok()) return false;
      const { entradas } = await r.json();
      return (
        Array.isArray(entradas) &&
        entradas.length > 0 &&
        /activo/i.test(JSON.stringify(entradas))
      );
    });
    expect(
      ok,
      "no aparecieron entradas de auditoría con /activo/i en 45s",
    ).toBe(true);
  });

  test("la tabla `auditoria` de la BPI tiene filas patrimoniales y de identidad de la org", async ({
    aft,
  }) => {
    void aft;
    const leer = () =>
      consultar<{ operacion: unknown; categoria: unknown }>(
        "core",
        `select operacion, categoria, resultado
           from auditoria
          where organizacion_id = $1 or organizacion_id is null
          order by fecha desc
          limit 200`,
        [ORG.id],
      );

    const ok = await hasta(async () => {
      const filas = await leer();
      if (filas.length === 0) return false;
      const ops = filas.map((f) => String(f.operacion));
      const hayActivos = ops.some((o) => /activos/i.test(o));
      const hayCatalogo = ops.some((o) => /catalogo-tipos/i.test(o));
      const hayIdentidad = filas.some(
        (f) =>
          /directivo\/usuarios/i.test(String(f.operacion)) &&
          String(f.categoria) === "identidad",
      );
      return hayActivos && hayCatalogo && hayIdentidad;
    });

    if (!ok) {
      // Diagnóstico útil si falla: qué operaciones sí quedaron registradas.
      const filas = await leer();
      const ops = [...new Set(filas.map((f) => String(f.operacion)))];
      expect(
        ok,
        `faltan filas de auditoría esperadas. Operaciones vistas: ${ops.join(", ")}`,
      ).toBe(true);
    }
  });
});
