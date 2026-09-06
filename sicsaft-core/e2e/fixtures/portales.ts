import {
  expect,
  request,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";
import { test as base } from "./electron";
import { URLS } from "../test-data";
import { leerCredenciales, marcarPasswordCambiada } from "./artefactos";

// Los portales embebidos que sirve el `.exe` en 127.0.0.1 -- se prueban con un chromium normal,
// no con la WebContentsView embebida. Es el mismo build de ccp/ y core/frontend/ y el mismo
// Keycloak; el login embebido del `.exe` sólo agrega el ruteo por rol + el watchdog (probados
// aparte en las specs de Electron).

export type Rol = "director" | "aft";

const PORTAL: Record<Rol, string> = {
  director: URLS.directivo,
  aft: URLS.ccp,
};

// Cada portal guarda sus tokens OIDC en sessionStorage con su propia clave (ver
// ccp/src/lib/oidc/token-store.ts y core/frontend/src/lib/oidc/token-store.ts).
const CLAVE_TOKENS: Record<Rol, string> = {
  aft: "web-sicsaft-oidc-tokens",
  director: "core-frontend-sicsaft-oidc-tokens",
};

/**
 * Completa el formulario de Keycloak. El realm tiene Organizations habilitado -> login en DOS
 * pasos (usuario, después contraseña). Si el usuario nunca cambió su clave inicial, Keycloak
 * mete la pantalla "Update password" (acción requerida del primer login) -- se completa con
 * `claveNueva` y se devuelve `true`.
 */
export async function completarLoginKeycloak(
  page: Page,
  email: string,
  password: string,
  claveNueva: string,
): Promise<{ cambioPassword: boolean }> {
  await page
    .locator("#username")
    .waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("#username").fill(email);

  const passwordYaVisible = await page
    .locator("#password")
    .isVisible()
    .catch(() => false);
  if (!passwordYaVisible) {
    await page.locator("#kc-login").click();
    await page
      .locator("#password")
      .waitFor({ state: "visible", timeout: 15_000 });
  }
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();

  // ¿Keycloak pidió cambiar la contraseña (primer login)?
  const pantallaUpdate = page.locator(
    "#password-new, #kc-passwd-update-form #password-new",
  );
  const apareceUpdate = await pantallaUpdate
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  if (apareceUpdate) {
    await page.locator("#password-new").fill(claveNueva);
    await page.locator("#password-confirm").fill(claveNueva);
    await page
      .locator("#kc-form-buttons button, input[type=submit], #savepassword")
      .first()
      .click();
    return { cambioPassword: true };
  }
  return { cambioPassword: false };
}

async function loginPorNavegador(page: Page, rol: Rol): Promise<string> {
  const cred = leerCredenciales();
  const datos = cred[rol];
  const origin = new URL(PORTAL[rol]).origin;
  const clave = CLAVE_TOKENS[rol];

  await page.goto(`${PORTAL[rol]}/`, { waitUntil: "domcontentloaded" });
  const boton = page.getByRole("button", { name: /iniciar sesión/i });
  if (await boton.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await boton.click({ noWaitAfter: true }).catch(() => undefined);
  }
  await page
    .waitForURL(
      /\/realms\/sicsaft\/(protocol\/openid-connect|login-actions)\//,
      {
        timeout: 30_000,
      },
    )
    .catch(() => undefined);

  const { cambioPassword } = await completarLoginKeycloak(
    page,
    datos.email,
    datos.passwordActual,
    // clave nueva == la que ya usamos si no es el primer login; si es el primero, una fija
    datos.passwordActual === datos.passwordInicial
      ? nuevaClaveDe(rol)
      : datos.passwordActual,
  );
  if (cambioPassword) {
    marcarPasswordCambiada(rol, nuevaClaveDe(rol));
  }

  await page
    .waitForURL(
      (u) => u.origin === origin && !u.pathname.startsWith("/auth/callback"),
      { timeout: 30_000 },
    )
    .catch(() => undefined);

  const raw = await page.evaluate((k) => sessionStorage.getItem(k), clave);
  if (!raw) {
    throw new Error(
      `El portal '${rol}' no guardó tokens OIDC tras el callback (url actual: ${page.url()})`,
    );
  }
  return (JSON.parse(raw) as { accessToken: string }).accessToken;
}

function nuevaClaveDe(rol: Rol): string {
  // Determinista por rol para que un segundo login use la misma.
  return `E2E-${rol}-Playwright-2026`;
}

export interface SesionPortal {
  page: Page;
  token: string;
  /** APIRequestContext con Bearer hacia CIS. */
  api: APIRequestContext;
}

async function conSesion(
  browser: Browser,
  rol: Rol,
  use: (s: SesionPortal) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const token = await loginPorNavegador(page, rol);
  const api = await request.newContext({
    baseURL: URLS.cis,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  try {
    await use({ page, token, api });
  } finally {
    await api.dispose();
    await context.close();
  }
}

// Se compone sobre la fixture `electron` (no sobre el `base` de @playwright/test) para heredar la
// fixture worker `exe`: así las sesiones de portal declaran su dependencia real del `.exe` (que
// sirve Keycloak/CIS/los portales) y Playwright lo mantiene vivo para las specs 05..11.
export const test = base.extend<{
  directivo: SesionPortal;
  aft: SesionPortal;
}>({
  directivo: async ({ browser, exe }, use) => {
    void exe;
    await conSesion(browser, "director", use);
  },
  aft: async ({ browser, exe }, use) => {
    void exe;
    await conSesion(browser, "aft", use);
  },
});

export { expect };
