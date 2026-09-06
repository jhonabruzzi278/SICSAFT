import { test, expect, irARuta } from "../fixtures/portales";
import { capturar } from "../fixtures/capturas";
import { ORG, URLS, USUARIOS } from "../test-data";

// Portal del Directivo (core/frontend) servido por el `.exe`. Complementa specs 08/09: la pantalla
// de Inicio (resuelve la org y entra al Dashboard), el drill-down por área del Dashboard, y la
// designación de un Profesional de AFT que YA existe en Keycloak (rama `creado: false`, sin clave
// nueva -- la de "crear uno nuevo" ya la cubre la 09).

test.describe("15 - Portal del Directivo: funciones", () => {
  test("Inicio: con una sola organización entra directo al Dashboard", async ({
    directivo,
  }, testInfo) => {
    await irARuta(directivo.page, `${URLS.directivo}/`);
    // InicioPage: organizaciones.length === 1 -> <Navigate to="/dashboard?organizacionId=...">
    await directivo.page.waitForURL(/\/dashboard\?organizacionId=/, {
      timeout: 15_000,
    });
    await expect(directivo.page).not.toHaveURL(/\/login$/);
    await capturar(
      directivo.page,
      testInfo,
      "directivo-inicio-redirige-dashboard",
    );
  });

  test("Dashboard: tarjetas de cobertura + drill-down por área", async ({
    directivo,
  }, testInfo) => {
    await irARuta(
      directivo.page,
      `${URLS.directivo}/dashboard?organizacionId=${ORG.id}`,
    );
    await expect(
      directivo.page.getByRole("heading", { name: /^Dashboard$/ }),
    ).toBeVisible();
    await expect(
      directivo.page.getByText(/activos registrados/i),
    ).toBeVisible();
    await expect(directivo.page.getByText(/% cobertura/i)).toBeVisible();
    await expect(
      directivo.page.getByRole("heading", { name: /áreas controladas/i }),
    ).toBeVisible();
    await capturar(directivo.page, testInfo, "directivo-dashboard");

    // Si hay áreas (las crean las specs de estructura / ingesta), elegir una filtra por `areaId`.
    // Los botones de área muestran "Controlada" o "Pendiente" (DashboardPage.tsx).
    const botonesArea = directivo.page
      .locator("button")
      .filter({ hasText: /controlada|pendiente/i });
    if ((await botonesArea.count()) > 0) {
      await botonesArea.first().click();
      await expect(directivo.page).toHaveURL(/areaId=/);
    }
  });

  test("Designar un Profesional de AFT que ya existe: lo designa sin clave nueva", async ({
    directivo,
  }, testInfo) => {
    await irARuta(
      directivo.page,
      `${URLS.directivo}/gestionar-profesional-aft`,
    );
    await directivo.page.locator("#profesional-email").fill(USUARIOS.aft.email); // el AFT del wizard -- ya tiene cuenta en Keycloak
    await directivo.page.getByRole("button", { name: /designar/i }).click();

    // Rama `creado: false`: mensaje distinto, sin <span class="font-mono"> con la clave.
    await expect(
      directivo.page.getByText(/ya tenía cuenta en keycloak/i),
    ).toBeVisible({ timeout: 20_000 });
    await capturar(
      directivo.page,
      testInfo,
      "directivo-designar-aft-existente",
    );

    // El AFT sigue en la lista de usuarios de la organización, con su rol.
    const r = await directivo.api.get("/directivo/usuarios");
    expect(r.ok()).toBeTruthy();
    const lista = (await r.json()) as Array<{
      email: string | null;
      roles: string[];
    }>;
    const aft = lista.find((u) => u.email === USUARIOS.aft.email);
    expect(
      aft,
      `esperaba ${USUARIOS.aft.email} en /directivo/usuarios`,
    ).toBeTruthy();
    expect(aft?.roles).toContain(USUARIOS.aft.rol);
  });
});
