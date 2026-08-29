// Capturas del rediseño móvil (2026-08-29) para revisión visual. No es un test de comportamiento:
// no hace asserts, sólo navega y guarda PNGs en test-results/redesign/. Correr con:
//   npx playwright test redesign-screenshots
import { test } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';

const OUT = 'test-results/redesign';
test.use({ viewport: { width: 390, height: 844 } });

/** Screenshot del viewport (no fullPage): el app bar fijo queda pinneado arriba como en un móvil real. */
async function shot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

async function toDark(page) {
  // Arranca en dark (defaultTheme). Este helper asegura dark tras un posible toggle previo.
  await page.evaluate(() => {
    if (!document.documentElement.classList.contains('dark')) {
      document.querySelector('[data-testid="theme-toggle"]')?.click();
    }
  });
  await page.waitForTimeout(200);
}
async function toLight(page) {
  await page.evaluate(() => {
    if (document.documentElement.classList.contains('dark')) {
      document.querySelector('[data-testid="theme-toggle"]')?.click();
    }
  });
  await page.waitForTimeout(200);
}

test('home', async ({ page }) => {
  await resetApp(page);
  await page.waitForSelector('[data-testid="start-scan-btn"]');
  await toDark(page);
  await shot(page, '01-home-dark');
  await toLight(page);
  await shot(page, '02-home-light');
});

test('reporte de control', async ({ page }) => {
  await resetApp(page);
  await toDark(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'p001');
  await scanCode(page, 'p002');
  await scanCode(page, 'p016');
  await shot(page, '03-scanning');
  await page.click('[data-testid="finish-btn"]');
  await page.waitForSelector('[data-testid="report-verdict"]');
  await shot(page, '04-report-top');
  await page.evaluate(() => window.scrollTo(0, 520));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/05-report-detail.png` });
});

test('historial', async ({ page }) => {
  await resetApp(page);
  await toDark(page);
  await page.click('[data-testid="start-scan-btn"]');
  await scanCode(page, 'p001');
  await scanCode(page, 'p777');
  await page.click('[data-testid="finish-btn"]');
  await page.click('[data-testid="confirm-send-btn"]');
  await page.click('[data-testid="nav-history"]');
  await page.waitForSelector('[data-testid="history-item"]');
  await shot(page, '06-history');
});

test('catálogo', async ({ page }) => {
  await resetApp(page);
  await toLight(page);
  await page.click('[data-testid="nav-catalog"]');
  await page.waitForSelector('[data-testid="registered-count"]');
  await shot(page, '07-catalog');
});
