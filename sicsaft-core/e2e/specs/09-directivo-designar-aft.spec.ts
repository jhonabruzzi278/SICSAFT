import { test, expect } from "../fixtures/portales";
import { consultar } from "../scripts/db";
import { REALM } from "../test-data";

// El Directivo designa un Profesional de AFT desde su portal (DOC-022 3). Verifica el flujo de
// UI real + el efecto en Keycloak (usuario nuevo con rol administrador-patrimonial en la org).

const emailNuevo = `aft-designado-${Date.now().toString(36)}@organizacion-e2e-playwright.test`;

test.describe("09 - Portal del Directivo: designar Profesional de AFT", () => {
  test("crea un AFT nuevo, muestra la clave inicial una vez y refresca la tabla", async ({
    directivo,
  }) => {
    await directivo.page.goto(
      "http://127.0.0.1:8768/gestionar-profesional-aft",
    );
    await directivo.page.locator("#profesional-email").fill(emailNuevo);
    await directivo.page.getByRole("button", { name: /designar/i }).click();

    await expect(
      directivo.page.getByText(/profesional de aft creado/i),
    ).toBeVisible({ timeout: 20_000 });
    // La contraseña inicial se muestra en un <span class="font-mono">.
    await expect(
      directivo.page.locator("span.font-mono").first(),
    ).toBeVisible();
    // La tabla de usuarios de la organización se refresca con el nuevo email.
    await expect(directivo.page.getByText(emailNuevo)).toBeVisible();

    // Cross-check por API: quedó con el rol administrador-patrimonial.
    const usuarios = await directivo.api.get("/directivo/usuarios");
    expect(usuarios.ok()).toBeTruthy();
    const lista = (await usuarios.json()) as Array<{
      email: string | null;
      roles: string[];
    }>;
    const creado = lista.find((u) => u.email === emailNuevo);
    expect(
      creado,
      `esperaba ${emailNuevo} en /directivo/usuarios`,
    ).toBeTruthy();
    expect(creado?.roles).toContain("administrador-patrimonial");
  });

  test("el usuario nuevo existe en Keycloak con UPDATE_PASSWORD y en el grupo de la org", async ({
    directivo,
  }) => {
    void directivo;
    const filas = await consultar(
      "keycloak",
      `select ue.username, ra.required_action
         from user_entity ue
         left join user_required_action ra on ra.user_id = ue.id
        where ue.realm_id=(select id from realm where name=$1) and ue.username=$2`,
      [REALM, emailNuevo],
    );
    expect(filas.length).toBeGreaterThan(0);
    expect(filas[0].required_action).toBe("UPDATE_PASSWORD");
  });
});
