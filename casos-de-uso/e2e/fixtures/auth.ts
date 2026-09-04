import {
  test as base,
  expect,
  request,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test';
import { URLS, USUARIOS } from '../test-data.mjs';

type Rol = 'directivo' | 'aft';

const PORTAL: Record<Rol, string> = {
  directivo: URLS.directivo,
  aft: URLS.ccp,
};

// Los tokens del portal viven en sessionStorage (ver ccp/src/lib/oidc/token-store.ts), que
// Playwright NO persiste con storageState — por eso cada fixture hace un login real por el
// navegador (formulario de Keycloak) en su propio context. Con ~6 tests el costo es aceptable.
const TOKENS_KEY = 'web-sicsaft-oidc-tokens';

async function loginPorNavegador(page: Page, rol: Rol): Promise<void> {
  const { email, password } = USUARIOS[rol];
  const origin = new URL(PORTAL[rol]).origin;

  await page.goto(`${PORTAL[rol]}/`);

  // Ambos portales muestran un botón "Iniciar sesión" que dispara el redirect a Keycloak.
  const boton = page.getByRole('button', { name: /iniciar sesión/i });
  if (await boton.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await boton.click();
  }

  // Formulario de Keycloak (salteado si ya hubiera una sesión SSO en este context).
  await page
    .waitForURL(/\/realms\/sicsaft\/protocol\/openid-connect\/auth/, { timeout: 20_000 })
    .catch(() => undefined);
  if (page.url().includes('/realms/sicsaft/')) {
    await page.fill('#username', email);
    await page.fill('#password', password);
    await page.click('#kc-login');
  }

  // Vuelta al portal y token ya guardado por AuthCallbackPage.
  await page.waitForURL(
    (u) => u.origin === origin && !u.pathname.startsWith('/auth/callback'),
    { timeout: 30_000 },
  );
  await expect
    .poll(async () => page.evaluate((k) => sessionStorage.getItem(k) !== null, TOKENS_KEY), {
      timeout: 15_000,
      message: 'el portal no guardó el token OIDC tras el callback',
    })
    .toBe(true);
}

async function tokenDeSesion(page: Page): Promise<string> {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), TOKENS_KEY);
  if (!raw) throw new Error('No hay token OIDC en sessionStorage — ¿falló el login?');
  return (JSON.parse(raw) as { accessToken: string }).accessToken;
}

interface SesionRol {
  /** Página del portal, ya autenticada. */
  page: Page;
  /** Access token JWT del usuario (para asserts a nivel API). */
  token: string;
  /** APIRequestContext con `Authorization: Bearer <token>` apuntando a CIS. */
  api: APIRequestContext;
}

/**
 * Fixtures `directivo` y `aft`: cada una entrega `{ page, token, api }` con una sesión real
 * (login por el formulario de Keycloak) en su propio browser context.
 */
export const test = base.extend<{ directivo: SesionRol; aft: SesionRol }>({
  directivo: async ({ browser }, use) => {
    await conSesion(browser, 'directivo', use);
  },
  aft: async ({ browser }, use) => {
    await conSesion(browser, 'aft', use);
  },
});

async function conSesion(
  browser: Browser,
  rol: Rol,
  use: (s: SesionRol) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await loginPorNavegador(page, rol);
  const token = await tokenDeSesion(page);
  const api = await request.newContext({
    baseURL: URLS.cis,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  try {
    await use({ page, token, api });
  } finally {
    await api.dispose();
    await context.close();
  }
}

export { expect };
