import { test, expect } from '@playwright/test';
import { resetApp, scanCode, selectOrgAreaLocation } from './helpers.js';

test('sin conexión, el inventario queda en cola y se sincroniza solo al volver', async ({ page }) => {
  await resetApp(page);

  // Precargar el chunk de Historial con conexión — es lazy() (App.tsx), su
  // import() dinámico necesita red la primera vez. Si no, romper la red antes
  // de visitarlo por primera vez rompe la navegación por una razón ajena a la
  // cola de sincronización.
  await page.click('[data-testid="nav-history"]');
  await page.click('[data-testid="nav-scan"]');
  await selectOrgAreaLocation(page);

  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');

  await page.context().setOffline(true);
  await page.click('[data-testid="finish-btn"]');
  await page.click('[data-testid="confirm-send-btn"]');
  await page.click('[data-testid="reset-btn"]');

  await page.click('[data-testid="nav-history"]');
  const item = page.locator('[data-testid="history-item"]').first();
  await expect(item.locator('[data-testid="history-sync-status"]')).toContainText('Pendiente de sincronizar');

  // DOC-002: "nunca reintento manual del operador" — volver a tener conexión
  // debe disparar el reintento solo, sin que el operador toque nada.
  await page.context().setOffline(false);
  await expect(item.locator('[data-testid="history-sync-status"]')).toContainText('Sincronizado', { timeout: 10_000 });
});
