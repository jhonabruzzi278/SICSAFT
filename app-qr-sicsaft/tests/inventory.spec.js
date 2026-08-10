import { test, expect } from '@playwright/test';
import { resetApp } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await page.click('[data-testid="nav-catalog"]');
});

test('agregar un producto nuevo lo muestra como registrado', async ({ page }) => {
  await page.click('[data-testid="new-product-btn"]');
  await page.fill('[data-testid="pf-name"]', 'Producto Nuevo');
  await page.fill('[data-testid="pf-code"]', 'p021');
  await page.click('[data-testid="pf-submit"]');

  await expect(page.locator('[data-testid="label-preview-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="print-label-code"]')).toHaveText('P021');
  await page.click('[data-testid="label-preview-close-btn"]');

  const card = page.locator('[data-testid="product-card"][data-code="P021"]');
  await expect(card).toBeVisible();
  await expect(page.locator('[data-testid="registered-count"]')).toHaveText('16');
});

test('no permite crear un producto con un código ya existente', async ({ page }) => {
  await page.click('[data-testid="new-product-btn"]');
  await page.fill('[data-testid="pf-name"]', 'Duplicado');
  await page.fill('[data-testid="pf-code"]', 'p001');
  await page.click('[data-testid="pf-submit"]');

  await expect(page.locator('[data-testid="pf-code-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="product-modal"]')).toBeVisible();
});

test('el toggle de IVA calcula el precio final a partir del precio sin impuestos', async ({ page }) => {
  await page.click('[data-testid="new-product-btn"]');
  await page.click('[data-testid="pf-has-iva"]');
  await expect(page.locator('[data-testid="pf-iva-fields"]')).toBeVisible();

  await page.fill('[data-testid="pf-iva-percent"]', '21');
  await page.fill('[data-testid="pf-price-no-tax"]', '100');

  await expect(page.locator('[data-testid="pf-final-price"]')).toHaveValue('121');
});

test('crear un producto con variantes genera códigos BASE-VARIANTE y permite imprimir etiquetas', async ({ page }) => {
  await page.evaluate(() => {
    window.print = () => {
      window.__printed = true;
    };
  });

  await page.click('[data-testid="new-product-btn"]');
  await page.fill('[data-testid="pf-name"]', 'Remera');
  await page.fill('[data-testid="pf-code"]', 'r001');

  await page.click('[data-testid="pf-add-variant"]');
  await page.fill('[data-testid="pf-variant-code"]', 's');
  await page.fill('[data-testid="pf-variant-stock"]', '5');

  await expect(page.locator('[data-testid="pf-stock"]')).toBeDisabled();

  await page.click('[data-testid="pf-submit"]');
  await expect(page.locator('[data-testid="label-preview-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="print-label-code"]')).toHaveText('R001-S');

  await page.click('[data-testid="label-preview-print"]');
  await expect(page.locator('[data-testid="print-options-modal"]')).toBeVisible();
  await page.click('[data-testid="print-columns-4"]');
  await page.click('[data-testid="print-options-confirm"]');

  const printed = await page.evaluate(() => window.__printed);
  expect(printed).toBe(true);
  const storedColumns = await page.evaluate(() => localStorage.getItem('qrvault-print-columns'));
  expect(storedColumns).toBe('4');
});

test('el diálogo de impresión recuerda la última cantidad de columnas elegida', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('qrvault-print-columns', '5'));
  await page.reload();
  await page.waitForTimeout(300);

  const card = page.locator('[data-testid="product-card"][data-code="P001"]');
  await card.locator('[data-testid="product-card-print"]').click();

  await expect(page.locator('[data-testid="print-options-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="print-columns-5"]')).toHaveAttribute('aria-pressed', 'true');
});

test('imprimir varias copias de la misma etiqueta genera esa cantidad de etiquetas', async ({ page }) => {
  await page.evaluate(() => {
    window.print = () => {
      window.__printedLabelCount = document.querySelectorAll('#label-print-area [data-testid="print-label"]').length;
    };
  });

  const card = page.locator('[data-testid="product-card"][data-code="P001"]');
  await card.locator('[data-testid="product-card-print"]').click();

  await expect(page.locator('[data-testid="print-options-modal"]')).toBeVisible();
  await page.fill('[data-testid="print-copies-input"]', '8');
  await expect(page.locator('[data-testid="print-options-summary"]')).toContainText('8 etiquetas en total');
  await page.click('[data-testid="print-options-confirm"]');

  const printedLabelCount = await page.evaluate(() => window.__printedLabelCount);
  expect(printedLabelCount).toBe(8);
});

test('un producto con stock igual o menor al mínimo muestra la insignia de stock bajo', async ({ page }) => {
  await page.click('[data-testid="new-product-btn"]');
  await page.fill('[data-testid="pf-name"]', 'Producto Bajo Stock');
  await page.fill('[data-testid="pf-code"]', 'b001');
  await page.fill('[data-testid="pf-stock"]', '3');
  await page.fill('[data-testid="pf-min-stock"]', '5');
  await page.click('[data-testid="pf-submit"]');
  await page.click('[data-testid="label-preview-close-btn"]');

  const card = page.locator('[data-testid="product-card"][data-code="B001"]');
  await expect(card.locator('[data-testid="product-card-badge"]')).toBeVisible();
});

test('quitar un producto del inventario lo marca como no registrado', async ({ page }) => {
  const card = page.locator('[data-testid="product-card"][data-code="P001"]');
  await card.locator('[data-testid="product-card-delete"]').click();

  await expect(page.locator('[data-testid="registered-count"]')).toHaveText('14');
  await expect(page.locator('[data-testid="unregistered-count"]')).toHaveText('6');
  await expect(card.locator('[data-testid="product-card-delete"]')).toHaveCount(0);
});

test('el buscador filtra por código y por nombre', async ({ page }) => {
  await page.fill('[data-testid="search-input"]', 'yogurt');
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(1);

  await page.fill('[data-testid="search-input"]', 'p003');
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(1);

  await page.fill('[data-testid="search-input"]', 'no-existe-este-producto');
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="no-results"]')).toBeVisible();
});

test('un nombre de producto largo y sin espacios no desborda la tarjeta en mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });

  await page.click('[data-testid="new-product-btn"]');
  await page.fill('[data-testid="pf-name"]', 'Shampoodeacondicionadorreparadorintensivoconqueratinayaceitedeargan500ml');
  await page.fill('[data-testid="pf-code"]', 'LONGNAME01');
  await page.click('[data-testid="pf-submit"]');
  await page.click('[data-testid="label-preview-close-btn"]');

  const card = page.locator('[data-testid="product-card"][data-code="LONGNAME01"]');
  await expect(card).toBeVisible();

  const overflow = await card.evaluate((el) => {
    let anyOverflow = false;
    el.querySelectorAll('*').forEach((child) => {
      if (child.scrollWidth > child.clientWidth + 1 && child.clientWidth > 0) anyOverflow = true;
    });
    return anyOverflow;
  });
  expect(overflow).toBe(false);

  const docOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(docOverflow).toBe(false);
});
