import { test, expect } from "../fixtures/portales";
import { URLS, USUARIOS } from "../test-data";

// El login del `.exe` detecta el rol del JWT y muestra el portal que corresponde: Directivo ->
// core/frontend, Profesional de AFT -> ccp. Acá se comprueba el resultado observable: el token
// de cada rol trae el claim correcto y sirve para operar su portal (y NO el del otro rol).

function claims(token: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(token.split(".")[1], "base64").toString("utf8"),
  );
}

test.describe("05 - Login OIDC y ruteo por rol", () => {
  test("el Directivo entra a su portal; el JWT trae rol 'directivo', aud 'cis' y su organización", async ({
    directivo,
  }) => {
    await expect(directivo.page).toHaveURL(new RegExp(`^${URLS.directivo}`));
    const c = claims(directivo.token);
    const aud = c.aud;
    expect(
      aud === "cis" || (Array.isArray(aud) && aud.includes("cis")),
    ).toBeTruthy();
    expect(JSON.stringify(c.realm_access ?? {})).toContain(
      USUARIOS.director.rol,
    );
    expect(JSON.stringify(c.organization ?? {})).toContain(
      "organizacion-e2e-playwright",
    );

    // CIS acepta el token del portal del Directivo.
    const sesion = await directivo.api.post("/auth/session", {
      data: { deviceId: "e2e-exe-directivo" },
    });
    expect(sesion.ok()).toBeTruthy();
  });

  test("el Profesional de AFT entra al CCP; el JWT trae rol 'administrador-patrimonial'", async ({
    aft,
  }) => {
    await expect(aft.page).toHaveURL(new RegExp(`^${URLS.ccp}`));
    const c = claims(aft.token);
    expect(JSON.stringify(c.realm_access ?? {})).toContain(USUARIOS.aft.rol);
    await expect(aft.page.getByText(/sicsaft/i).first()).toBeVisible();
    await expect(aft.page).not.toHaveURL(/\/login$/);
  });

  test("credenciales inválidas → Keycloak las rechaza y no hay token", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${URLS.ccp}/`);
    const boton = page.getByRole("button", { name: /iniciar sesión/i });
    if (await boton.isVisible().catch(() => false)) {
      await boton.click({ noWaitAfter: true }).catch(() => undefined);
    }
    await page.waitForURL(/\/realms\/sicsaft\//, { timeout: 30_000 });
    await page.locator("#username").fill(USUARIOS.aft.email);
    if (
      !(await page
        .locator("#password")
        .isVisible()
        .catch(() => false))
    ) {
      await page.locator("#kc-login").click();
      await page.locator("#password").waitFor({ state: "visible" });
    }
    await page.locator("#password").fill("clave-incorrecta-e2e");
    await page.locator("#kc-login").click();

    await expect(page).toHaveURL(
      /\/realms\/sicsaft\/(login-actions|protocol\/openid-connect)\//,
    );
    await expect(
      page.locator(
        "#input-error, .kc-feedback-text, [class*='alert-error'], #kc-error-message",
      ),
    ).toBeVisible();
    const t = await page.evaluate(() =>
      sessionStorage.getItem("web-sicsaft-oidc-tokens"),
    );
    expect(t).toBeNull();
    await ctx.close();
  });

  test("ruta protegida sin sesión → redirige a /login", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(
      `${URLS.ccp}/activos?organizacionId=organizacion-e2e-playwright`,
    );
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("button", { name: /iniciar sesión/i }),
    ).toBeVisible();
    await ctx.close();
  });
});
