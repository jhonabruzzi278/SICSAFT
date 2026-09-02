import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

// Fase 3.1/DOC-017 — selector de modo, veredicto de sesión, estado operativo declarado, baja
// sugerida y lista de AFT fuera de área con su área real.
// Ubicación por defecto de los tests (tests/helpers.js: org-001/area-001/loc-001): esperados =
// P001-P004 (ver catalog-data.ts).

test('el selector de modo muestra Modo 3 deshabilitado y Modo 1/2 llevan al mismo escaneo', async ({ page }) => {
  await resetApp(page);

  await expect(page.locator('[data-testid="scan-mode-qr"]')).toBeEnabled();
  await expect(page.locator('[data-testid="scan-mode-qr-web"]')).toBeEnabled();
  await expect(page.locator('[data-testid="scan-mode-qr-web-rfid"]')).toBeDisabled();

  await page.click('[data-testid="scan-mode-qr-web"]');
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');
  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('1');
});

test('el veredicto es exitoso cuando no falta nada y nada aparece fuera de área', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  await scanCode(page, 'P001');
  await scanCode(page, 'P002');
  await scanCode(page, 'P003');
  await scanCode(page, 'P004');
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-verdict"]')).toHaveText('Exitoso');
  await expect(page.locator('[data-testid="report-verdict"]')).toHaveAttribute('data-verdict', 'exitoso');

  // DOC-029 RF-I / CONTRATO-PANTALLA-8 — bloques 2 y 4 del informe de control de área.
  await expect(page.locator('[data-testid="report-area-pct"]')).toHaveText('100 %');
  const escaneados = page.locator('[data-testid="report-scanned-list"] li');
  await expect(escaneados).toHaveCount(4);
  await expect(escaneados.first()).toContainText('ORDINARIO');
});

test('el veredicto es aceptable cuando falta un activo pero nada aparece fuera de área', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  // P001-P003 (esta área) — P004 queda faltante, nada aparece fuera de área: exactamente un
  // problema, no ambos (ver lib/verdict.ts).
  await scanCode(page, 'P001');
  await scanCode(page, 'P002');
  await scanCode(page, 'P003');
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-verdict"]')).toHaveText('Aceptable');
  await expect(page.locator('[data-testid="report-verdict"]')).toHaveAttribute('data-verdict', 'aceptable');
});

test('el veredicto es defectuoso cuando faltan activos y aparece uno de otra área', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  // P001 (esta área) + P008 (otra área, ver catalog-data.ts) — P002/P003/P004 quedan faltantes.
  await scanCode(page, 'P001');
  await scanCode(page, 'P008');
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-verdict"]')).toHaveAttribute('data-verdict', 'defectuoso');
});

test('declarar mantenimiento en un activo y confirmar el envío no rompe el flujo', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');

  await page.selectOption('[data-testid="estado-declarado-select"]', 'mantenimiento');
  await expect(page.locator('[data-testid="estado-declarado-select"]')).toHaveValue('mantenimiento');

  await page.click('[data-testid="finish-btn"]');

  // DOC-029 RF-I / CONTRATO-PANTALLA-8 — bloque 3: el estado declarado por el controlador
  // aparece en el desglose del informe (EN MANTENIMIENTO = 1).
  const desglose = page.locator('[data-testid="report-estado-declarado"]');
  await expect(desglose).toContainText('EN MANTENIMIENTO');
  await expect(desglose).toContainText('1');

  await page.click('[data-testid="confirm-send-btn"]');
  await expect(page.locator('[data-testid="confirm-send-btn"]')).toHaveText('Enviado ✔');
});

test('sugerir baja guarda el motivo sin ejecutar ninguna baja', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');

  await page.click('[data-testid="suggest-baja-btn"]');
  await expect(page.locator('[data-testid="baja-sugerida-modal"]')).toBeVisible();
  await page.fill('[data-testid="baja-sugerida-note-input"]', 'Pantalla rota, no enciende');
  await page.click('[data-testid="baja-sugerida-save-btn"]');

  await expect(page.locator('[data-testid="scanned-item-baja-sugerida"]')).toContainText(
    'Pantalla rota, no enciende',
  );
  // El botón queda disponible para editar la sugerencia — nunca "ejecuta" nada desde acá, solo
  // guarda el texto informativo (mismo patrón que "Editar incidencia").
  await expect(page.locator('[data-testid="suggest-baja-btn"]')).toHaveText('Editar sugerencia de baja');
});

test('un activo de otra área aparece agrupado por su área real en el reporte', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P008'); // otra área, ver catalog-data.ts
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-out-of-area-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="report-out-of-area-list"]')).toContainText('area-002');
  await expect(page.locator('[data-testid="report-out-of-area-list"]')).toContainText('P008');
});
