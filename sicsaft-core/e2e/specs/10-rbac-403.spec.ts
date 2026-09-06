import { test, expect } from "../fixtures/portales";

// El gate RBAC de CIS es real (server-side, no de UI): un Profesional de AFT NO puede usar los
// endpoints del Directivo aunque tenga un token válido. QA-6.3.

test.describe("10 - RBAC: CIS rechaza al AFT en endpoints del Directivo", () => {
  test("GET /directivo/usuarios con token de AFT → 403", async ({ aft }) => {
    const r = await aft.api.get("/directivo/usuarios");
    expect(r.status()).toBe(403);
  });

  test("POST /directivo/usuarios con token de AFT → 403", async ({ aft }) => {
    const r = await aft.api.post("/directivo/usuarios", {
      data: { email: "intruso-e2e@organizacion-e2e-playwright.test" },
    });
    expect(r.status()).toBe(403);
  });

  test("el Directivo SÍ puede (GET /directivo/usuarios → 200)", async ({
    directivo,
  }) => {
    const r = await directivo.api.get("/directivo/usuarios");
    expect(r.ok()).toBeTruthy();
    const lista = await r.json();
    expect(Array.isArray(lista)).toBe(true);
  });
});
