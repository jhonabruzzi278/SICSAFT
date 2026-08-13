import { test, expect } from '@playwright/test';
import { resetApp, scanCode, seedAuth } from './helpers.js';

test('la sesión OIDC persiste tras recargar la página', async ({ page }) => {
  await resetApp(page);

  // El token ya está en sessionStorage (oidcClient, TASK-007): tras recargar, la app arranca
  // directo en selección de organización, sin volver a mandar al operador a loguearse.
  await page.reload();
  await page.waitForTimeout(300);

  await expect(page.locator('[data-testid="operator-login-btn"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="organization-select"]')).toBeVisible();
});

test('el select de ubicación queda deshabilitado hasta elegir un área', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('qrvault-inventory'));
  await page.reload();
  await page.waitForTimeout(500);

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
  // CIS/CORE no exponen nombre propio de área (buildOrganizationTree, qr-connector.ts) — se
  // muestra el id crudo tal cual, a diferencia de organización/ubicación que sí tienen nombre real.
  await expect(page.locator('[data-testid="session-summary"]')).toContainText('area-001');
  await expect(page.locator('[data-testid="session-summary"]')).toContainText('Edificio Principal — Piso 1');
});

test('el historial muestra los metadatos de la sesión y el estado de sincronización', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');
  await page.click('[data-testid="finish-btn"]');
  await page.click('[data-testid="confirm-send-btn"]');
  await page.click('[data-testid="reset-btn"]');

  await page.click('[data-testid="nav-history"]');

  const item = page.locator('[data-testid="history-item"]').first();
  await expect(item.locator('[data-testid="history-location"]')).toContainText('Operador Test');
  await expect(item.locator('[data-testid="history-location"]')).toContainText('Municipalidad Central');
  await expect(item.locator('[data-testid="history-sync-status"]')).toContainText('Sincronizado');
});
