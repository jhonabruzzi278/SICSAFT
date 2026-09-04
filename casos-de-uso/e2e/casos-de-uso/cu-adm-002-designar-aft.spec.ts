import { test, expect } from '../fixtures/auth';
import { URLS } from '../test-data.mjs';

// CU-ADM-002 — Asignar roles / designar Profesional de AFT (DOC-022 3).
// MATRIZ-TRAZABILIDAD.md: "designar AFT desde core/frontend". Cubre PLAN-QA.md QA-6.3
// (el gate es real en CIS, no de UI).

test.describe('CU-ADM-002 Designar Profesional de AFT', () => {
  test('el Directivo designa un Profesional de AFT desde su portal', async ({ directivo }) => {
    const email = `aft-designado-${Date.now().toString(36)}@duoc-uc.e2e`;

    await directivo.page.goto(`${URLS.directivo}/gestionar-profesional-aft`);
    await directivo.page.fill('#profesional-email', email);
    await directivo.page.getByRole('button', { name: /designar/i }).click();

    // Usuario nuevo → el portal muestra la contraseña inicial una sola vez.
    await expect(directivo.page.getByText(/profesional de aft creado/i)).toBeVisible();
    await expect(directivo.page.locator('.font-mono').first()).toBeVisible();

    // La tabla de usuarios de la organización se refresca con el nuevo email.
    await expect(directivo.page.getByText(email)).toBeVisible();

    // Cross-check por API: quedó con el rol administrador-patrimonial en la organización.
    const usuarios = await directivo.api.get('/directivo/usuarios');
    expect(usuarios.ok()).toBeTruthy();
    const lista = (await usuarios.json()) as Array<{ email: string | null; roles: string[] }>;
    const creado = lista.find((u) => u.email === email);
    expect(creado, `esperaba encontrar ${email} en /directivo/usuarios`).toBeTruthy();
    expect(creado?.roles).toContain('administrador-patrimonial');
  });

  test('un Profesional de AFT no puede designar (CIS responde 403, no sólo la UI) — QA-6.3', async ({
    aft,
  }) => {
    const get = await aft.api.get('/directivo/usuarios');
    expect(get.status()).toBe(403);

    const post = await aft.api.post('/directivo/usuarios', {
      data: { email: 'intruso@duoc-uc.e2e' },
    });
    expect(post.status()).toBe(403);
  });
});
