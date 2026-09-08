// Capturas del rediseño del Portal WEB (2026-08-29) para revisión visual. Sin asserts: navega y
// guarda PNGs en test-results/redesign/. Correr con: npx playwright test redesign-screenshots
import { test } from '@playwright/test';
import { seedAuth } from './helpers.js';

const OUT = 'docs/screenshots';
test.use({ viewport: { width: 1440, height: 900 } });

test('login', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('button:has-text("Iniciar sesión")');
  await page.screenshot({ path: `${OUT}/01-login.png` });
});

test('hub (multi-organización)', async ({ page }) => {
  await page.route('**/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizaciones: [
          {
            id: 'duoc-uc',
            nombre: 'EMPRESA SUCHEL TROPICAL - DIRECCIÓN TÉCNICO-PRODUCTIVA',
            sedes: [
              { id: 's1', nombre: 'Planta Técnico-Productiva Principal' },
            ],
          },
          {
            id: 'muni-melipilla',
            nombre: 'EMPRESA SUCHEL TROPICAL - DIRECCIÓN COMERCIAL',
            sedes: [
              { id: 's2', nombre: 'Oficinas Dirección Comercial' },
              { id: 's3', nombre: 'Anexo Logística' },
            ],
          },
        ],
      }),
    }),
  );
  await seedAuth(page);
  await page.goto('/');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/02-hub.png`, fullPage: true });
});

test('dashboard', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/dashboard?organizacionId=duoc-uc');
  await page.waitForSelector(
    'h1:has-text("Resumen Operativo"), h1:has-text("Dashboard")',
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/03-dashboard.png`, fullPage: true });
});

test('activos', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/activos?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Crear activo")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/04-activos.png`, fullPage: true });
});
