import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

// Cuenta las sesiones guardadas directo en IndexedDB — navegar a /history
// remonta ScanPage (limitación conocida desde TASK-004: pierde el estado de
// la sesión en curso), así que no sirve para verificar el estado "todavía no
// se envió" sin abandonar el flujo que se está probando.
async function countSavedSessions(page) {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('qrvault-inventory');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('sessions', 'readonly');
          const countReq = tx.objectStore('sessions').count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => reject(countReq.error);
        };
        request.onerror = () => reject(request.error);
      }),
  );
}

// Ubicación por defecto de los tests (tests/helpers.js: org-001/area-001/loc-001):
// esperados = P001-P004 (ver catalog-data.ts).

test('el resumen muestra esperados/faltantes y activos externos', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  await scanCode(page, 'P001');
  await scanCode(page, 'P002');
  await scanCode(page, 'P003');
  await scanCode(page, 'P999');
  await page.click('[data-testid="mark-external-find-btn"]');

  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-expected"]')).toHaveText('4');
  await expect(page.locator('[data-testid="report-missing"]')).toHaveText('1');
  await expect(page.locator('[data-testid="report-missing-list"]')).toContainText('P004');
  await expect(page.locator('[data-testid="report-external-finds"]')).toHaveText('1');
});

test('el inventario no se guarda hasta confirmar el envío', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="confirm-send-btn"]')).toHaveText('Confirmar y enviar');
  expect(await countSavedSessions(page)).toBe(0);

  await page.click('[data-testid="confirm-send-btn"]');
  await expect(page.locator('[data-testid="confirm-send-btn"]')).toHaveText('Enviado ✔');
  expect(await countSavedSessions(page)).toBe(1);
});
