import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

const REGISTERED_CODES = Array.from({ length: 15 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`);
const UNREGISTERED_CODES = ['P016', 'P017', 'P018', 'P019', 'P020'];

test('home page loads without console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await resetApp(page);

  expect(errors).toEqual([]);
  await expect(page.locator('[data-testid="start-scan-btn"]')).toBeVisible();
});

test('Prueba 1 del spec: 15 productos registrados -> 15/15/0', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  for (const code of REGISTERED_CODES) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-total"]')).toHaveText('15');
  await expect(page.locator('[data-testid="report-found"]')).toHaveText('15');
  await expect(page.locator('[data-testid="report-missing"]')).toHaveText('0');
});

test('Prueba 2 del spec: 16 productos (15 + 1 no registrado) -> 16/15/1 con P016', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  for (const code of [...REGISTERED_CODES, 'P016']) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-total"]')).toHaveText('16');
  await expect(page.locator('[data-testid="report-found"]')).toHaveText('15');
  await expect(page.locator('[data-testid="report-missing"]')).toHaveText('1');
  await expect(page.locator('[data-testid="report-missing-list"]')).toContainText('P016');
});

test('Prueba 3 del spec: 20 productos -> 20/15/5 con P016-P020', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  for (const code of [...REGISTERED_CODES, ...UNREGISTERED_CODES]) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-total"]')).toHaveText('20');
  await expect(page.locator('[data-testid="report-found"]')).toHaveText('15');
  await expect(page.locator('[data-testid="report-missing"]')).toHaveText('5');
  for (const code of UNREGISTERED_CODES) {
    await expect(page.locator('[data-testid="report-missing-list"]')).toContainText(code);
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
