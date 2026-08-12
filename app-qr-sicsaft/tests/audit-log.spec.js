import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

test('el registro de auditoría refleja inicio, escaneo, incidencia, cierre y sincronización', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');

  await page.click('[data-testid="add-incident-btn"]');
  await page.fill('[data-testid="incident-note-input"]', 'Golpe visible en la carcasa');
  await page.click('[data-testid="incident-save-btn"]');

  await page.click('[data-testid="finish-btn"]');
  await page.click('[data-testid="reset-btn"]');

  await page.click('[data-testid="nav-history"]');
  await page.click('[data-testid="toggle-audit-btn"]');

  const auditList = page.locator('[data-testid="audit-list"]');
  await expect(auditList).toContainText('Inventario iniciado');
  await expect(auditList).toContainText('Escaneo');
  await expect(auditList).toContainText('P001');
  await expect(auditList).toContainText('Incidencia registrada');
  await expect(auditList).toContainText('Golpe visible en la carcasa');
  await expect(auditList).toContainText('Inventario finalizado');
  await expect(auditList).toContainText('Estado de sincronización');
});
