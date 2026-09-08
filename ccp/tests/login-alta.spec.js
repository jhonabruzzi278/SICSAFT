import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers.js';

test.describe('Autenticación', () => {
  test('un operador sin sesión es redirigido a /login', async ({ page }) => {
    await page.goto('/activos');
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('button', { name: 'Iniciar sesión' }),
    ).toBeVisible();
  });
});

test.describe('Login + alta de activo (RF-01/RF-03/RF-08)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('un operador autenticado aterriza directo en el dashboard y da de alta un activo visible de inmediato', async ({
    page,
  }) => {
    await page.goto('/dashboard?organizacionId=duoc-uc');

    // RF-02 — hub post-login: con una sola organización con contrato vigente (fixture, ver
    // MOCK_ORGANIZACIONES) redirige directo al dashboard en vez de mostrar el picker de
    // organizaciones, para que el sidebar de módulos aparezca de inmediato (ver HubPage.tsx).
    await expect(page).toHaveURL(/\/dashboard\?organizacionId=/, { timeout: 10_000 });
    await page.waitForSelector('h1:has-text("Resumen Operativo"), h1:has-text("Dashboard")');

    await page.goto('/activos?organizacionId=duoc-uc');
    await page.waitForSelector('button:has-text("Crear activo")');

    // Catálogo inicial del fixture (MOCK_CATALOGO) ya visible.
    await expect(page.getByText(/DC-01|DTP-01|QR-DG-001/).first()).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Código patrimonial').fill('PAT-E2E-001');
    await page.getByLabel('Código QR').fill('QR-E2E-001');
    // RF-12 (DOC-021, gap "familias/categorías") — selector real alimentado por
    // GET /admin/catalogo-tipos, ya no texto libre.
    await page.getByLabel('Catálogo (tipo)').selectOption('catalogo-notebook');
    await page.getByRole('button', { name: 'Crear activo' }).click();

    // RF-08 — el alta debe verse en el mismo catálogo sin recargar la página a mano.
    await expect(page.getByText('Activo creado.')).toBeVisible();
    await expect(page.getByText('QR-E2E-001').first()).toBeVisible();
  });
});
