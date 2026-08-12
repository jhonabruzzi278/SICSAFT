import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

test('el operador persiste tras recargar la página', async ({ page }) => {
  await resetApp(page);

  const stored = await page.evaluate(() => localStorage.getItem('qrvault-operator'));
  expect(stored).toBe('Operador Test');

  await page.reload();
  await page.waitForTimeout(300);

  // El operador ya está guardado: la app arranca directo en selección de
  // organización, sin volver a pedir el nombre.
  await expect(page.locator('[data-testid="operator-name-input"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="organization-select"]')).toBeVisible();
});

test('el select de ubicación queda deshabilitado hasta elegir un área', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('qrvault-inventory'));
  await page.reload();
  await page.waitForTimeout(500);

  await page.fill('[data-testid="operator-name-input"]', 'Operador Test');
  await page.click('[data-testid="operator-continue-btn"]');

  await page.click('[data-testid="organization-select"]');
  await page.click('[data-testid="organization-option-org-001"]');

  await expect(page.locator('[data-testid="location-select"]')).toBeDisabled();

  await page.click('[data-testid="area-select"]');
  await page.click('[data-testid="area-option-area-001"]');

  await expect(page.locator('[data-testid="location-select"]')).toBeEnabled();
});

test('la pantalla de inicio muestra el resumen de operador/organización/área/ubicación', async ({ page }) => {
  await resetApp(page);

  await expect(page.locator('[data-testid="session-summary"]')).toContainText('Operador Test');
  await expect(page.locator('[data-testid="session-summary"]')).toContainText('Municipalidad Central');
  await expect(page.locator('[data-testid="session-summary"]')).toContainText('Administración');
  await expect(page.locator('[data-testid="session-summary"]')).toContainText('Edificio Principal — Piso 1');
});

test('el historial muestra los metadatos de la sesión y el estado de sincronización', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');
  await page.click('[data-testid="finish-btn"]');
  await page.click('[data-testid="reset-btn"]');

  await page.click('[data-testid="nav-history"]');

  const item = page.locator('[data-testid="history-item"]').first();
  await expect(item.locator('[data-testid="history-location"]')).toContainText('Operador Test');
  await expect(item.locator('[data-testid="history-location"]')).toContainText('Municipalidad Central');
  await expect(item.locator('[data-testid="history-sync-status"]')).toContainText('Sincronizado');
});
