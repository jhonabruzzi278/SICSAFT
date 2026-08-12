import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

// Ubicación por defecto de los tests (tests/helpers.js): org-001/area-001/loc-001.
// P001 = correcto, P005 = otra ubicación (misma área), P008 = otra área
// (misma organización) — ver catalog-data.ts.

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
});

test('clasifica un activo correcto', async ({ page }) => {
  await scanCode(page, 'P001');
  await expect(page.locator('[data-testid="scanned-item-status"]')).toHaveText('✔ Correcto');
});

test('clasifica un activo de otra área y permite marcarlo fuera de lugar', async ({ page }) => {
  await scanCode(page, 'P008');
  await expect(page.locator('[data-testid="scanned-item-status"]')).toHaveText('⚠ Otra área');
  await expect(page.locator('[data-testid="scanned-item-expected"]')).toContainText('Obras Públicas');

  await page.click('[data-testid="mark-out-of-place-btn"]');
  await expect(page.locator('[data-testid="mark-out-of-place-btn"]')).toHaveText('Marcado fuera de lugar');
});

test('clasifica un activo de otra ubicación', async ({ page }) => {
  await scanCode(page, 'P005');
  await expect(page.locator('[data-testid="scanned-item-status"]')).toHaveText('⚠ Otra ubicación');
  await expect(page.locator('[data-testid="scanned-item-expected"]')).toContainText('Edificio Principal — Piso 2');
});

test('clasifica un activo no registrado y permite registrarlo como hallazgo externo', async ({ page }) => {
  await scanCode(page, 'P999');
  await expect(page.locator('[data-testid="scanned-item-status"]')).toHaveText('✖ No registrado');

  await page.click('[data-testid="mark-external-find-btn"]');
  await expect(page.locator('[data-testid="external-find-badge"]')).toBeVisible();
  await expect(page.locator('[data-testid="mark-external-find-btn"]')).toHaveCount(0);
});

test('descartar un activo no registrado lo saca de la lista', async ({ page }) => {
  await scanCode(page, 'P999');
  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('1');

  await page.click('[data-testid="discard-item-btn"]');
  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('0');
});

test('un código con formato inválido no se agrega a la lista', async ({ page }) => {
  await scanCode(page, '###');
  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('0');
});

test('agregar una incidencia queda reflejada en el ítem y en el reporte', async ({ page }) => {
  await scanCode(page, 'P001');
  await page.click('[data-testid="add-incident-btn"]');
  await expect(page.locator('[data-testid="incident-modal"]')).toBeVisible();

  await page.fill('[data-testid="incident-note-input"]', 'Golpe visible en la carcasa');
  await page.click('[data-testid="incident-save-btn"]');

  await expect(page.locator('[data-testid="scanned-item-incident-note"]')).toContainText('Golpe visible');

  await page.click('[data-testid="finish-btn"]');
  await expect(page.locator('[data-testid="report-incidents"]')).toHaveText('1');
});
