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

test.describe('Login + módulos vigentes del CCP', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('un operador autenticado aterriza en el dashboard y /activos vuelve al hub', async ({
    page,
  }) => {
    await page.goto('/dashboard?organizacionId=duoc-uc');

    // RF-02 — hub post-login: con una sola organización con contrato vigente (fixture, ver
    // MOCK_ORGANIZACIONES) redirige directo al dashboard en vez de mostrar el picker de
    // organizaciones, para que el sidebar de módulos aparezca de inmediato (ver HubPage.tsx).
    await expect(page).toHaveURL(/\/dashboard\?organizacionId=/, {
      timeout: 10_000,
    });
    await page.waitForSelector(
      'h1:has-text("Resumen Operativo"), h1:has-text("Dashboard")',
    );

    // Fase 3 CCP/CIP: Activos ya no vive en CCP. La URL histórica no expone la pantalla ni sus
    // acciones de escritura y vuelve al flujo autenticado del hub/dashboard.
    await page.goto('/activos?organizacionId=duoc-uc');
    await expect(page).toHaveURL(/\/(dashboard)?\?organizacionId=/, {
      timeout: 10_000,
    });
    await expect(
      page.getByRole('button', { name: 'Crear activo' }),
    ).toHaveCount(0);
  });
});
