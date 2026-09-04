import { test, expect } from '../fixtures/auth';
import { URLS, USUARIOS } from '../test-data.mjs';

// CU-SEG-001 — Autenticar (casos-de-uso/dominios/CU-SEG-seguridad.md).
// §12.36: "el actor autorizado puede iniciarlo · las excepciones se controlan".
// Cubre PLAN-QA.md QA-0.4 / QA-0.5 / QA-6.1 / QA-6.6.

test.describe('CU-SEG-001 Autenticar', () => {
  test('el Directivo autentica por OIDC/PKCE y entra a su portal', async ({ directivo }) => {
    // La fixture ya hizo el login real (formulario de Keycloak). Verificamos el resultado.
    await expect(directivo.page).toHaveURL(new RegExp(`^${URLS.directivo}`));

    // El JWT trae el rol y la organización correctos (límite de confianza real = CIS, DOC-013 4).
    const [, payloadB64] = directivo.token.split('.');
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    expect(claims.aud === 'cis' || (Array.isArray(claims.aud) && claims.aud.includes('cis'))).toBeTruthy();
    expect(JSON.stringify(claims.realm_access?.roles ?? [])).toContain('directivo');
    expect(JSON.stringify(claims.organization ?? {})).toContain('duoc-uc');

    // CIS acepta el token del portal del Directivo.
    const sesion = await directivo.api.post('/auth/session', {
      data: { deviceId: 'cu-seg-001-directivo' },
    });
    expect(sesion.ok()).toBeTruthy();
  });

  test('el Profesional de AFT autentica y entra al CCP', async ({ aft }) => {
    await expect(aft.page).toHaveURL(new RegExp(`^${URLS.ccp}`));

    const [, payloadB64] = aft.token.split('.');
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    expect(JSON.stringify(claims.realm_access?.roles ?? [])).toContain('administrador-patrimonial');

    // El CCP montó su shell (no una pantalla de error de auth): el branding SICSAFT del AppShell
    // está presente en cualquier ruta ya autenticada.
    await expect(aft.page.getByText(/sicsaft/i).first()).toBeVisible();
    await expect(aft.page).not.toHaveURL(/\/login$/);
  });

  test('credenciales inválidas → Keycloak las rechaza y no entrega sesión (QA-6.1)', async ({
    page,
  }) => {
    await page.goto(`${URLS.ccp}/`);
    const boton = page.getByRole('button', { name: /iniciar sesión/i });
    if (await boton.isVisible().catch(() => false)) await boton.click();

    await page.waitForURL(/\/realms\/sicsaft\/protocol\/openid-connect\/auth/, { timeout: 20_000 });
    await page.fill('#username', USUARIOS.aft.email);
    await page.fill('#password', 'password-incorrecta');
    await page.click('#kc-login');

    // Sigue en Keycloak (no redirigió al portal) y muestra un error de credenciales.
    await expect(page).toHaveURL(/\/realms\/sicsaft\/protocol\/openid-connect\//);
    await expect(
      page.locator('#input-error, .kc-feedback-text, [class*="alert-error"], #kc-error-message'),
    ).toBeVisible();
    const tokenTrasFallo = await page.evaluate(() =>
      sessionStorage.getItem('web-sicsaft-oidc-tokens'),
    );
    expect(tokenTrasFallo).toBeNull();
  });

  test('ruta protegida sin sesión → redirige a login (QA-6.6)', async ({ page }) => {
    await page.goto(`${URLS.ccp}/activos?organizacionId=duoc-uc`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  });
});
