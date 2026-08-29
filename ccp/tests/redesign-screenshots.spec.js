// Capturas del rediseño del Portal WEB (2026-08-29) para revisión visual. Sin asserts: navega y
// guarda PNGs en test-results/redesign/. Correr con: npx playwright test redesign-screenshots
import { test } from '@playwright/test';
import { seedAuth } from './helpers.js';

const OUT = 'test-results/redesign';
test.use({ viewport: { width: 1440, height: 900 } });

test('login', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('button:has-text("Iniciar sesión")');
  await page.screenshot({ path: `${OUT}/01-login.png` });
});

test('hub (multi-organización)', async ({ page }) => {
  await seedAuth(page);
  // El mock trae 1 sola org (redirige directo al dashboard) — se fuerzan 2 para ver el hub.
  await page.route('**/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizaciones: [
          { id: 'duoc-uc', nombre: 'DUOC UC', sedes: [{ id: 's1', nombre: 'Sede Melipilla' }] },
          { id: 'muni-melipilla', nombre: 'Municipalidad de Melipilla', sedes: [{ id: 's2', nombre: 'Casa Central' }, { id: 's3', nombre: 'Anexo' }] },
        ],
      }),
    }),
  );
  await page.goto('/');
  await page.waitForSelector('text=Organizaciones');
  await page.screenshot({ path: `${OUT}/02-hub.png`, fullPage: true });
});

test('dashboard', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/dashboard?organizacionId=duoc-uc');
  await page.waitForSelector('h1:has-text("Dashboard")');
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
