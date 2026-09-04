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

// Cada portal guarda sus tokens OIDC en sessionStorage bajo su propia clave (ver
// ccp/src/lib/oidc/token-store.ts y core/frontend/src/lib/oidc/token-store.ts). Playwright NO
// persiste sessionStorage con storageState — por eso cada fixture hace un login real por el
// navegador (formulario de Keycloak) en su propio context.
const TOKENS_KEY: Record<Rol, string> = {
  aft: 'web-sicsaft-oidc-tokens',
  directivo: 'core-frontend-sicsaft-oidc-tokens',
};

/**
 * Completa el formulario de Keycloak. El realm tiene Organizations habilitado, así que el login
 * es en DOS pasos (`login-username.ftl` → `login-password.ftl`): usuario primero, contraseña
 * después. Si el `#password` ya estuviera en la misma página (flujo clásico), se saltea el submit
 * intermedio. No espera el resultado — el llamador decide qué verificar (vuelta al portal, o un
 * error de credenciales).
 */
export async function completarLoginKeycloak(
  page: Page,
  credenciales: { email: string; password: string },
): Promise<void> {
  await page.locator('#username').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#username').fill(credenciales.email);

  const passwordYaVisible = await page
    .locator('#password')
    .isVisible()
    .catch(() => false);
  if (!passwordYaVisible) {
    await page.locator('#kc-login').click(); // "Sign In" del paso de usuario
    // La corrida en frío de Keycloak a veces devuelve una página de error en este paso — no
    // esperamos 15s de timeout, cortamos apenas aparezca el error o el campo de contraseña.
    await Promise.race([
      page.locator('#password').waitFor({ state: 'visible', timeout: 15_000 }),
      page
        .getByText(/we are sorry|unexpected error/i)
        .waitFor({ state: 'visible', timeout: 15_000 })
        .catch(() => undefined),
    ]);
    if (await page.getByText(/we are sorry|unexpected error/i).isVisible().catch(() => false)) {
      throw new Error('Keycloak devolvió una página de error en el paso de usuario (reintentar)');
    }
  }

  await page.locator('#password').fill(credenciales.password);
  await page.locator('#kc-login').click();
}

async function intentarLogin(page: Page, rol: Rol): Promise<boolean> {
  const { email, password } = USUARIOS[rol];
  const origin = new URL(PORTAL[rol]).origin;
  const tokensKey = TOKENS_KEY[rol];

  try {
    await page.goto(`${PORTAL[rol]}/`, { waitUntil: 'domcontentloaded' });

    // Ambos portales muestran un botón "Iniciar sesión" que dispara `window.location.assign(<KC>)`.
    const boton = page.getByRole('button', { name: /iniciar sesión/i });
    if (await boton.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await boton.click({ noWaitAfter: true }).catch(() => undefined);
    }

    await page
      .waitForURL(/\/realms\/sicsaft\/(protocol\/openid-connect|login-actions)\//, {
        timeout: 30_000,
      })
      .catch(() => undefined);
    if (/\/realms\/sicsaft\//.test(page.url())) {
      await completarLoginKeycloak(page, { email, password });
    }

    await page
      .waitForURL((u) => u.origin === origin && !u.pathname.startsWith('/auth/callback'), {
        timeout: 30_000,
      })
      .catch(() => undefined);

    return await page
      .evaluate((k) => sessionStorage.getItem(k) !== null, tokensKey)
      .catch(() => false);
  } catch {
    // Cualquier fallo (página de error de Keycloak en frío, timeout de campo) → el loop reintenta.
    return false;
  }
}

async function loginPorNavegador(page: Page, rol: Rol): Promise<void> {
  for (let intento = 1; intento <= 4; intento += 1) {
    if (await intentarLogin(page, rol)) return;
    await page.waitForTimeout(1500);
  }
  throw new Error(`No se pudo completar el login OIDC de '${rol}' tras 4 intentos`);
}

async function tokenDeSesion(page: Page, rol: Rol): Promise<string> {
  const raw = await page.evaluate((k) => sessionStorage.getItem(k), TOKENS_KEY[rol]);
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
  const token = await tokenDeSesion(page, rol);
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
