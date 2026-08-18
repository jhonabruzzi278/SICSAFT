import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers.js';

test.describe('Autenticación', () => {
  test('un operador sin sesión es redirigido a /login', async ({ page }) => {
    await page.goto('/activos');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });
});

test.describe('Login + alta de activo (RF-01/RF-03/RF-08)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('un operador autenticado ve el hub y da de alta un activo visible de inmediato', async ({
    page,
  }) => {
    await page.goto('/');

    // RF-02 — hub post-login, lista organizaciones con contrato vigente.
    await expect(page.getByRole('heading', { name: 'Organizaciones' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DUOC UC' })).toBeVisible();

    await page.getByRole('link', { name: 'Activos' }).click();
    await expect(page).toHaveURL(/\/activos\?organizacionId=/);

    // Catálogo inicial del fixture (MOCK_CATALOGO) ya visible.
    await expect(page.getByText('QR-NOTEBOOK-001')).toBeVisible();

    await page.getByLabel('Código patrimonial').fill('PAT-E2E-001');
    await page.getByLabel('Código QR').fill('QR-E2E-001');
    // RF-12 (DOC-021, gap "familias/categorías") — selector real alimentado por
    // GET /admin/catalogo-tipos, ya no texto libre.
    await page.getByLabel('Catálogo (tipo)').selectOption('catalogo-notebook');
    await page.getByRole('button', { name: 'Crear activo' }).click();

    // RF-08 — el alta debe verse en el mismo catálogo sin recargar la página a mano.
    await expect(page.getByText('Activo creado.')).toBeVisible();
    await expect(page.getByText('QR-E2E-001')).toBeVisible();
  });
});
