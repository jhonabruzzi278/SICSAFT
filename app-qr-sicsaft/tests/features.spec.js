import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

test('entrada manual de código agrega un producto escaneado', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  await scanCode(page, 'p001');

  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('1');
  await expect(page.locator('[data-testid="scanned-item-code"]')).toHaveText('P001');
  await expect(page.locator('[data-testid="manual-code-input"]')).toHaveValue('');
});

test('en mobile, el trigger del sidebar despliega el menú y queda visible (no atascado en opacidad 0)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await resetApp(page);

  await page.click('[data-testid="sidebar-trigger"]');

  const nav = page.locator('[data-testid="nav-catalog"]');
  await expect(nav).toBeVisible();
  await expect(nav).toHaveCSS('opacity', '1');

  await nav.click();
  await expect(page).toHaveURL(/\/catalog$/);
});

test('el escáner reconoce un código de variante BASE-VARIANTE', async ({ page }) => {
  await resetApp(page);

  await page.click('[data-testid="nav-catalog"]');
  await page.click('[data-testid="new-product-btn"]');
  await page.fill('[data-testid="pf-name"]', 'Gorra');
  await page.fill('[data-testid="pf-code"]', 'V001');
  await page.click('[data-testid="pf-add-variant"]');
  await page.fill('[data-testid="pf-variant-code"]', 'm');
  await page.fill('[data-testid="pf-variant-name"]', 'Mediana');
  await page.click('[data-testid="pf-submit"]');
  await expect(page.locator('[data-testid="label-preview-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="print-label-code"]')).toHaveText('V001-M');
  await page.click('[data-testid="label-preview-close-btn"]');

  await page.click('[data-testid="nav-scan"]');
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'v001-m');

  await expect(page.locator('[data-testid="scanned-count"]')).toHaveText('1');
  await expect(page.locator('[data-testid="scanned-item-status"]')).toHaveText('✔ Encontrado');
});

test('el toggle de tema cambia la clase dark del html y persiste en localStorage', async ({ page }) => {
  await resetApp(page);

  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.click('[data-testid="theme-toggle"]');
  await expect(page.locator('html')).not.toHaveClass(/dark/);

  const stored = await page.evaluate(() => localStorage.getItem('qrvault-theme'));
  expect(stored).toBe('light');

  await page.reload();
  await page.waitForTimeout(300);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('finalizar escaneo guarda una sesión y aparece en el historial', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');

  const codes = Array.from({ length: 20 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`);
  for (const code of codes) {
    await scanCode(page, code);
  }

  await page.click('[data-testid="finish-btn"]');
  await expect(page.locator('[data-testid="report-total"]')).toHaveText('20');

  await page.click('[data-testid="reset-btn"]');
  await page.click('[data-testid="nav-history"]');

  await expect(page.locator('[data-testid="history-item"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="history-item"]')).toContainText('20 escaneados');
  await expect(page.locator('[data-testid="history-item"]')).toContainText('15 encontrados');
  await expect(page.locator('[data-testid="history-item"]')).toContainText('P016');
});

test('exportar CSV genera un archivo con los productos escaneados', async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'P001');
  await scanCode(page, 'P999');
  await page.click('[data-testid="finish-btn"]');
  await expect(page.locator('[data-testid="export-csv-btn"]')).toBeVisible();

  const csv = await page.evaluate(async () => {
    let capturedBlob = null;
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      capturedBlob = blob;
      return origCreate.call(URL, blob);
    };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};

    document.querySelector('[data-testid="export-csv-btn"]').click();
    await new Promise((resolve) => setTimeout(resolve, 50));

    URL.createObjectURL = origCreate;
    HTMLAnchorElement.prototype.click = origClick;
    return capturedBlob ? capturedBlob.text() : null;
  });

  expect(csv).toContain('codigo,nombre,estado');
  expect(csv).toContain('P001,Caramelos Verdes,encontrado');
  expect(csv).toContain('P999,Producto desconocido,no_registrado');
});
