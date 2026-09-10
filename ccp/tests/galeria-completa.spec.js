import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers.js';

// Suite de Capturas Visuales Completas de Alta Resolución (1440x900)
// Documenta el 100% de los flujos solicitados por el usuario:
//  - Paso a paso de instalación y registro de organización (Pasos 1 al 4)
//  - Portales, Logins, Hub Multi-organización
//  - Módulo de Impresión Masiva de Etiquetas con Plantillas Industriales (Mejora 2 / RF-F)
//  - Módulo de Ingesta Excel Drag & Drop con Diff Visual en tiempo real (Mejora 6 / RF-B)
//  - Catálogo, Estructura y Auditoría BPI

const OUT = 'docs/screenshots';
test.use({ viewport: { width: 1440, height: 900 } });

// ==========================================
// 1. WIZARD DE INSTALACIÓN Y REGISTRO
// ==========================================

test('01 - Wizard: Datos de Instalación y Organización', async ({ page }) => {
  await page.goto('/wizard-preview?paso=1');
  await page.waitForSelector('h1:has-text("Datos de esta instalación")');
  await expect(
    page.getByRole('heading', { name: /datos de esta instalación/i }),
  ).toBeVisible();
  await page.screenshot({
    path: `${OUT}/01-wizard-paso-1-datos-organizacion.png`,
    fullPage: true,
  });
});

test('02 - Wizard: Alta del Director y Contraseña Temporal', async ({
  page,
}) => {
  await page.goto('/wizard-preview?paso=2');
  await page.waitForSelector('h1:has-text("Alta del Director General")');
  await expect(
    page.getByRole('heading', { name: /alta del director general/i }),
  ).toBeVisible();
  await page.screenshot({
    path: `${OUT}/02-wizard-paso-2-alta-director.png`,
    fullPage: true,
  });
});

test('03 - Wizard: Alta del Profesional AFT', async ({ page }) => {
  await page.goto('/wizard-preview?paso=3');
  await page.waitForSelector('h1:has-text("Alta del Profesional de AFT")');
  await expect(
    page.getByRole('heading', { name: /alta del profesional de aft/i }),
  ).toBeVisible();
  await page.screenshot({
    path: `${OUT}/03-wizard-paso-3-alta-aft.png`,
    fullPage: true,
  });
});

test('04 - Wizard: Instalación Completa con Acceso Móvil QR Dual', async ({
  page,
}) => {
  await page.goto('/wizard-preview?paso=4');
  await page.waitForSelector('h1:has-text("Instalación completa")');
  await expect(
    page.getByRole('heading', { name: /instalación completa/i }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${OUT}/04-wizard-paso-4-instalacion-completa-qr.png`,
    fullPage: true,
  });
});

// ==========================================
// 2. LOGINS Y HUB
// ==========================================

test('05 - Login del Portal SICSAFT', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('button:has-text("Iniciar sesión")');
  await expect(
    page.getByRole('button', { name: /iniciar sesión/i }),
  ).toBeVisible();
  await page.screenshot({
    path: `${OUT}/05-login-portal-sicsaft.png`,
    fullPage: true,
  });
});

test('06 - Hub Multi-organización y Sedes', async ({ page }) => {
  await page.route('**/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        organizaciones: [
          {
            id: 'duoc-uc',
            nombre: 'EMPRESA SUCHEL TROPICAL - DIRECCIÓN GENERAL',
            sedes: [
              { id: 's1', nombre: 'Oficina Director General & Secretaría' },
              { id: 's2', nombre: 'Salón de Reuniones' },
            ],
          },
          {
            id: 'muni-melipilla',
            nombre: 'EMPRESA SUCHEL TROPICAL - DIRECCIÓN COMERCIAL',
            sedes: [
              { id: 's3', nombre: 'Edificio Consistorial Comercial' },
              { id: 's4', nombre: 'Anexo Logística & Distribución' },
            ],
          },
        ],
      }),
    }),
  );
  await seedAuth(page);
  await page.goto('/');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT}/06-hub-organizaciones-sedes.png`,
    fullPage: true,
  });
});

// ==========================================
// 3. RESUMEN OPERATIVO DEL CCP
// ==========================================

test('07 - CCP Resumen Operativo', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/dashboard?organizacionId=duoc-uc');
  await page.waitForSelector('h1:has-text("Resumen Operativo")');
  await expect(
    page.getByRole('heading', { name: /resumen operativo/i }),
  ).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT}/07-ccp-resumen-operativo.png`,
    fullPage: true,
  });
});

// El CIP salió del CCP el 2026-09-09 (pedido del usuario): la analítica de Nivel 2 es del
// Directivo y vive en su portal. Este test es el guard de esa decisión — una URL vieja no debe
// encontrar nada acá, ni siquiera una pantalla sin salida.
test('08 - El CIP ya no vive en el CCP: /cip redirige al hub', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/cip?organizacionId=duoc-uc');
  // El catch-all de App.tsx manda a "/", y desde ahí el hub puede seguir redirigiendo solo
  // (con una única organización aterriza en /dashboard). Lo que importa es que /cip no exista.
  await expect(page).not.toHaveURL(/\/cip/);
  await expect(page.getByText(/CIP Analytics/i)).toHaveCount(0);
});

// ==========================================
// 4. GESTIÓN PATRIMONIAL Y ESTRUCTURA
// ==========================================

test('10 - CCP: Catálogo de Activos Fijos', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/activos?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Crear activo")');
  await expect(page.getByText('DC-01').first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/10-ccp-catalogo-activos.png`,
    fullPage: true,
  });
});

test('11 - CCP: Estructura Patrimonial (Áreas y Dependencias)', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/estructura?organizacionId=duoc-uc');
  await page.waitForSelector(
    'button:has-text("Crear área"), button:has-text("Guardar"), h1',
  );
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/11-ccp-estructura-patrimonial.png`,
    fullPage: true,
  });
});

// ==========================================
// 5. MEJORA 2: IMPRESIÓN MASIVA DE ETIQUETAS
// ==========================================

test('12 - Mejora 2: Etiquetas Masivas - Plantilla Avery 5160 (3x10)', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('text=Impresión Masiva de Etiquetas');
  await expect(page.getByText('DC-01').first()).toBeVisible({
    timeout: 10_000,
  });
  const totalEtiquetas = await page
    .locator(
      'img[alt*="QR"], .etiqueta-industrial, [data-testid="etiqueta-activo"]',
    )
    .count();
  expect(totalEtiquetas).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT}/12-ccp-etiquetas-plantilla-avery.png`,
    fullPage: true,
  });
});

test('13 - Mejora 2: Etiquetas Masivas - Plantilla Tarjetas de Inventario (2x5)', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Tarjetas 2×5")');
  await page.getByRole('button', { name: 'Tarjetas 2×5' }).click();
  await expect(page.getByText('DC-01').first()).toBeVisible({
    timeout: 10_000,
  });
  const totalEtiquetas = await page
    .locator(
      'img[alt*="QR"], .etiqueta-industrial, [data-testid="etiqueta-activo"]',
    )
    .count();
  expect(totalEtiquetas).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT}/13-ccp-etiquetas-plantilla-tarjetas.png`,
    fullPage: true,
  });
});

test('14 - Mejora 2: Etiquetas Masivas - Plantilla Rollo Térmico (1x1)', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Térmica 1×1")');
  await page.getByRole('button', { name: 'Térmica 1×1' }).click();
  await expect(page.getByText('DC-01').first()).toBeVisible({
    timeout: 10_000,
  });
  const totalEtiquetas = await page
    .locator(
      'img[alt*="QR"], .etiqueta-industrial, [data-testid="etiqueta-activo"]',
    )
    .count();
  expect(totalEtiquetas).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT}/14-ccp-etiquetas-plantilla-termica.png`,
    fullPage: true,
  });
});

test('15 - Mejora 2: Etiquetas Masivas - Simulación de Hoja de Papel Troquelada', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Simular Papel")');
  await page.getByRole('button', { name: 'Simular Papel' }).click();
  await expect(page.getByText('DC-01').first()).toBeVisible({
    timeout: 10_000,
  });
  const totalEtiquetas = await page
    .locator(
      'img[alt*="QR"], .etiqueta-industrial, [data-testid="etiqueta-activo"]',
    )
    .count();
  expect(totalEtiquetas).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT}/15-ccp-etiquetas-simulacion-papel.png`,
    fullPage: true,
  });
});

// ==========================================
// 6. INGESTA CONTABLE: BANDEJA Y REVISIÓN DE LOTES
// ==========================================

test('16 - Ingesta contable: bandeja directa a BPI', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/importaciones?organizacionId=duoc-uc');
  await page.waitForSelector(
    'h1:has-text("Bandeja de Ingesta Contable Directa a BPI")',
  );
  await page.waitForSelector('text=Carpeta Vigilada de Ingesta Contable');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/16-ccp-importaciones-dropzone.png`,
    fullPage: true,
  });
});

test('17 - Ingesta contable: lotes recibidos y su detalle', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/importaciones?organizacionId=duoc-uc');
  await page.waitForSelector(
    'h1:has-text("Bandeja de Ingesta Contable Directa a BPI")',
  );
  await page.waitForSelector('text=Lotes recibidos');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${OUT}/17-ccp-importaciones-diff-visual.png`,
    fullPage: true,
  });
});

// ==========================================
// 7. AUDITORÍA BPI
// ==========================================

test('18 - CCP: Auditoría y Trazabilidad Transversal de la BPI', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/auditoria?organizacionId=duoc-uc');
  await page.waitForSelector('h1:has-text("Auditoría")');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${OUT}/18-ccp-auditoria-trazabilidad.png`,
    fullPage: true,
  });
});
