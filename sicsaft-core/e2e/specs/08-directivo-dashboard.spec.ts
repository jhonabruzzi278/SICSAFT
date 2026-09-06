import { test, expect } from "../fixtures/portales";
import { ORG, URLS } from "../test-data";

// Portal del Directivo (core/frontend) servido por el `.exe`. Con Nivel 2 el Dashboard ejecutivo
// (indicadores del CIP) está presente; la navegación del portal funciona con la sesión real.

test.describe("08 - Portal del Directivo: Dashboard (Nivel 2 / CIP)", () => {
  test("el Directivo ve el Dashboard ejecutivo y el menú Directivo", async ({
    directivo,
  }) => {
    await directivo.page.goto(`${URLS.directivo}/`);
    await expect(directivo.page).not.toHaveURL(/\/login$/);

    // Cabecera del portal + email del usuario.
    await expect(
      directivo.page.getByText(/portal del directivo/i).first(),
    ).toBeVisible();
    await expect(
      directivo.page.getByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();

    // Tarjetas de indicadores (el CIP los alimenta; recién instalado están en 0).
    await expect(
      directivo.page.getByText(/activos registrados/i),
    ).toBeVisible();
    await expect(directivo.page.getByText(/% cobertura/i)).toBeVisible();

    // El menú lateral tiene el acceso a "Profesional de AFT".
    await expect(
      directivo.page.getByRole("link", { name: /profesional de aft/i }),
    ).toBeVisible();
  });

  test("los endpoints del dashboard (CIP connector) responden 200 con el token del Directivo", async ({
    directivo,
  }) => {
    // `organizacionId` es requerido por el schema del dashboard-connector de CIS
    // (coberturaQuerySchema, DOC-019 3.1) -- sin él responde 400.
    for (const ruta of [
      "/dashboard/cobertura",
      "/dashboard/categorias",
      "/dashboard/estado-activos",
    ]) {
      const r = await directivo.api.get(`${ruta}?organizacionId=${ORG.id}`);
      expect(r.ok(), `${ruta} → ${r.status()} ${await r.text()}`).toBeTruthy();
    }
  });
});
