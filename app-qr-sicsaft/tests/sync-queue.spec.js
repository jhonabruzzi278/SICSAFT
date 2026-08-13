import { test, expect } from '@playwright/test';
import { resetApp, scanCode, selectOrgAreaLocation, setInventarioFailing } from './helpers.js';

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

  // MSW responde dentro del Service Worker sin tocar red real, así que page.context().setOffline()
  // no garantiza que un fetch mockeado falle — se simula la falla directo en el handler de
  // POST /inventarios (ver plan de e2e, HANDOFF §7).
  await setInventarioFailing(page, true);
  await page.click('[data-testid="finish-btn"]');
  await page.click('[data-testid="confirm-send-btn"]');
  await page.click('[data-testid="reset-btn"]');

  await page.click('[data-testid="nav-history"]');
  const item = page.locator('[data-testid="history-item"]').first();
  await expect(item.locator('[data-testid="history-sync-status"]')).toContainText('Pendiente de sincronizar');

  // DOC-002: "nunca reintento manual del operador" — volver a tener conexión
  // debe disparar el reintento solo, sin que el operador toque nada.
  await setInventarioFailing(page, false);
  await expect(item.locator('[data-testid="history-sync-status"]')).toContainText('Sincronizado', { timeout: 10_000 });
});
