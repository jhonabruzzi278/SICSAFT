// Base64url sin dependencias — helpers.js corre en Node (Playwright test runner), no en el
// navegador, así que Buffer está disponible.
function base64url(json) {
  return Buffer.from(json)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Siembra sessionStorage con un JWT sin firmar (oidcClient.decodeJwtClaims no verifica firma,
// sólo lee el claim `name` para mostrar el operador — CIS es quien valida de verdad, server-side)
// antes de la primera navegación. Salta OperatorGate por completo: ya no hay login por texto
// desde TASK-007, ver HANDOFF §7 (plan de e2e con MSW).
export async function seedAuth(page, { operator = 'Operador Test' } = {}) {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ name: operator, sub: 'operator-test' }));
  const fakeJwt = `${header}.${payload}.`;
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

  await page.addInitScript(
    ([token, exp]) => {
      sessionStorage.setItem(
        'qrvault-oidc-tokens',
        JSON.stringify({ accessToken: token, refreshToken: 'mock-refresh-token', expiresAt: exp }),
      );
    },
    [fakeJwt, expiresAt],
  );
}

export async function selectOrgAreaLocation(
  page,
  { organizationId = 'org-001', areaId = 'area-001', locationId = 'loc-001' } = {},
) {
  await page.click('[data-testid="organization-select"]');
  await page.click(`[data-testid="organization-option-${organizationId}"]`);

  await page.click('[data-testid="area-select"]');
  await page.click(`[data-testid="area-option-${areaId}"]`);

  await page.click('[data-testid="location-select"]');
  await page.click(`[data-testid="location-option-${locationId}"]`);

  await page.click('[data-testid="area-location-continue-btn"]');
}

export async function resetApp(page, opts = {}) {
  await seedAuth(page, opts);
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('qrvault-inventory'));
  await page.reload();
  await page.waitForTimeout(500);
  await selectOrgAreaLocation(page, opts);
}

export async function scanCode(page, code) {
  await page.fill('[data-testid="manual-code-input"]', code);
  await page.click('[data-testid="manual-code-btn"]');
}

// Reemplaza page.context().setOffline(true/false) para simular falla de red en POST /inventarios:
// MSW responde dentro del Service Worker sin tocar red real, así que el offline emulado por
// Playwright no garantiza que un fetch mockeado falle (ver plan de e2e, HANDOFF §7). El control
// vive en window.__mockControls (src/mocks/browser.ts), sólo existe en modo mock (VITE_MOCK_API).
export async function setInventarioFailing(page, failing) {
  await page.evaluate((v) => window.__mockControls.setInventarioFailing(v), failing);
}
