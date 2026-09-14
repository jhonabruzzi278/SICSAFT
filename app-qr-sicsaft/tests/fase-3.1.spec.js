import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

// Fase 3.1/DOC-017 — selector de modo, veredicto de sesión, estado operativo declarado, baja
// sugerida y lista de AFT fuera de área con su área real.
// Ubicación por defecto de los tests (tests/helpers.js: org-001/area-001/loc-001): esperados =
// QR-DG-001 a QR-DG-004 y QR-DG-010 a QR-DG-015 (10 activos, ver catalog-data.ts). QR-DG-008 =
// otra área (area-002, OFICINA SECRETARIA EJECUTIVA, ver fixtures.ts areaNameMap).
const ESPERADOS_AREA_001_LOC_001 = [
  'QR-DG-001',
  'QR-DG-002',
  'QR-DG-003',
  'QR-DG-004',
  'QR-DG-010',
  'QR-DG-011',
  'QR-DG-012',
  'QR-DG-013',
  'QR-DG-014',
  'QR-DG-015',
];

test('el selector de modo muestra Modo 3 deshabilitado y Modo 1/2 llevan al mismo escaneo', async ({ page }) => {
  await resetApp(page);

  await expect(page.locator('[data-testid="scan-mode-qr"]')).toBeEnabled();
  await expect(page.locator('[data-testid="scan-mode-qr-web"]')).toBeEnabled();
  await expect(page.locator('[data-testid="scan-mode-qr-web-rfid"]')).toBeDisabled();

  await page.click('[data-testid="scan-mode-qr-web"]');
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'QR-DG-001');
  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('1');
});

test('el veredicto es exitoso cuando no falta nada y nada aparece fuera de área', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  for (const code of ESPERADOS_AREA_001_LOC_001) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-verdict"]')).toHaveText('Exitoso');
  await expect(page.locator('[data-testid="report-verdict"]')).toHaveAttribute('data-verdict', 'exitoso');

  // DOC-029 RF-I / CONTRATO-PANTALLA-8 — bloques 2 y 4 del informe de control de área.
  await expect(page.locator('[data-testid="report-area-pct"]')).toHaveText('100 %');
  const escaneados = page.locator('[data-testid="report-scanned-list"] li');
  await expect(escaneados).toHaveCount(ESPERADOS_AREA_001_LOC_001.length);
  await expect(escaneados.first()).toContainText('ORDINARIO');
});

test('el veredicto es aceptable cuando falta un activo pero nada aparece fuera de área', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  // 9 de los 10 esperados (queda 1 faltante) — nada aparece fuera de área: exactamente un
  // problema, no ambos (ver lib/verdict.ts).
  for (const code of ESPERADOS_AREA_001_LOC_001.slice(0, -1)) {
    await scanCode(page, code);
  }
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-verdict"]')).toHaveText('Aceptable');
  await expect(page.locator('[data-testid="report-verdict"]')).toHaveAttribute('data-verdict', 'aceptable');
});

test('el veredicto es defectuoso cuando faltan activos y aparece uno de otra área', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  // QR-DG-001 (esta área) + QR-DG-008 (otra área: OFICINA SECRETARIA EJECUTIVA) — el resto de
  // ESPERADOS_AREA_001_LOC_001 queda faltante.
  await scanCode(page, 'QR-DG-001');
  await scanCode(page, 'QR-DG-008');
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-verdict"]')).toHaveAttribute('data-verdict', 'defectuoso');
});

test('declarar mantenimiento en un activo y confirmar el envío no rompe el flujo', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'QR-DG-001');

  await page.selectOption('[data-testid="estado-declarado-select"]', 'mantenimiento');
  await expect(page.locator('[data-testid="estado-declarado-select"]')).toHaveValue('mantenimiento');

  await page.click('[data-testid="finish-btn"]');

  // DOC-029 RF-I / CONTRATO-PANTALLA-8 — bloque 3: el estado declared por el controlador
  // aparece en el desglose del informe (EN MANTENIMIENTO = 1).
  const desglose = page.locator('[data-testid="report-estado-declarado"]');
  await expect(desglose).toContainText('EN MANTENIMIENTO');
  await expect(desglose).toContainText('1');

  await page.click('[data-testid="confirm-send-btn"]');
  await expect(page.locator('[data-testid="reset-btn"]')).toBeVisible();
});

test('sugerir baja guarda el motivo sin ejecutar ninguna baja', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'QR-DG-001');

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
  await scanCode(page, 'QR-DG-008'); // otra área: OFICINA SECRETARIA EJECUTIVA (area-002)
  await page.click('[data-testid="finish-btn"]');

  await expect(page.locator('[data-testid="report-out-of-area-list"]')).toBeVisible();
  await expect(page.locator('[data-testid="report-out-of-area-list"]')).toContainText('OFICINA SECRETARIA EJECUTIVA');
  await expect(page.locator('[data-testid="report-out-of-area-list"]')).toContainText('QR-DG-008');
});
