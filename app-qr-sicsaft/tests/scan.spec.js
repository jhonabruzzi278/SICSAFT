import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

// Con la ubicación por defecto de los tests (org-001/area-001/loc-001, ver
// tests/helpers.js) el catálogo demo (catalog-data.ts) se reparte así:
// P001-P004 = correcto, P005-P007 = otra ubicación, P008-P009 = otra área,
// P010-P015 = otra organización (clasifica como no registrado),
// P016-P020 = no están en la DB (no registrado).
const REGISTERED_CODES = Array.from({ length: 15 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`);
const UNREGISTERED_CODES = ['P016', 'P017', 'P018', 'P019', 'P020'];

test('home page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await resetApp(page);

  expect(errors).toEqual([]);
  await expect(page.locator('[data-testid="start-scan-btn"]')).toBeVisible();
});

test('Prueba 1 del spec: 15 productos registrados -> 4 correctos, 5 fuera de lugar, 6 no registrados', async ({
  page,
}) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  for (const code of REGISTERED_CODES) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-total"]')).toHaveText('15');
  await expect(page.locator('[data-testid="report-correct"]')).toHaveText('4');
  await expect(page.locator('[data-testid="report-out-of-place"]')).toHaveText('5');
  await expect(page.locator('[data-testid="report-unregistered"]')).toHaveText('6');
});

test('Prueba 2 del spec: 15 registrados + P016 -> 7 no registrados, incluye P016', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  for (const code of [...REGISTERED_CODES, 'P016']) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-total"]')).toHaveText('16');
  await expect(page.locator('[data-testid="report-unregistered"]')).toHaveText('7');
  await expect(page.locator('[data-testid="report-detail-list"]')).toContainText('P016');
});

test('Prueba 3 del spec: 15 registrados + P016-P020 -> 11 no registrados', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  for (const code of [...REGISTERED_CODES, ...UNREGISTERED_CODES]) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-total"]')).toHaveText('20');
  await expect(page.locator('[data-testid="report-correct"]')).toHaveText('4');
  await expect(page.locator('[data-testid="report-out-of-place"]')).toHaveText('5');
  await expect(page.locator('[data-testid="report-unregistered"]')).toHaveText('11');
  for (const code of UNREGISTERED_CODES) {
    await expect(page.locator('[data-testid="report-detail-list"]')).toContainText(code);
  }
});

test('re-escanear el mismo código no duplica el conteo', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  await scanCode(page, 'P001');
  await scanCode(page, 'P001');

  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('1');
});

test('el catálogo renderiza los 20 QR con el split correcto de registrados', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="nav-catalog"]');

  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(20);
  await expect(page.locator('[data-testid="registered-count"]')).toHaveText('15');
  await expect(page.locator('[data-testid="unregistered-count"]')).toHaveText('5');
});
