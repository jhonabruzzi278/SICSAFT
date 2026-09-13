import { test, expect } from '@playwright/test';
import { seedAuth } from './helpers.js';

// Suite de Capturas Visuales Completas de Alta Resolución (1440x900)
// Documenta el 100% de los flujos solicitados por el usuario:
//  - Paso a paso de instalación y registro de organización (Pasos 1 al 4)
//  - Portales, Logins, Hub Multi-organización
//  - Módulo de Ingesta Excel Drag & Drop con Diff Visual en tiempo real (Mejora 6 / RF-B)
//  - Estructura y Auditoría BPI
// Catálogo de Activos, Controles de área e Impresión de Etiquetas ya no viven acá (Fases 3/4/5 de
// la reestructuración CCP/CIP, 2026-09-13) — ver los guard tests "08a"/"08b"/"08c".

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

// Controles de área (Inventarios) se mudó al CIP el mismo día (Fase 4): tampoco tiene ruta propia
// en el CCP. Mismo criterio de guard.
test('08a - Controles de área ya no vive en el CCP: /inventarios redirige al hub', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/inventarios?organizacionId=duoc-uc');
  await expect(page).not.toHaveURL(/\/inventarios/);
  await expect(
    page.getByText(/Controles de Área y Contrastación BPI/i),
  ).toHaveCount(0);
});

// El catálogo de Activos se mudó al CIP el 2026-09-13 (Fase 3 de la reestructuración CCP/CIP):
// ya no tiene ruta propia en el CCP. Mismo criterio de guard que el test anterior para /cip.
test('08b - Activos ya no vive en el CCP: /activos redirige al hub', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/activos?organizacionId=duoc-uc');
  await expect(page).not.toHaveURL(/\/activos/);
  await expect(page.getByText(/Catálogo de Activos Fijos/i)).toHaveCount(0);
});

// La Impresión de Etiquetas se extrajo del CCP el mismo día (Fase 5) a un programa de escritorio
// standalone (herramientas/generador-qr/) — tampoco tiene ruta propia en el CCP.
test('08c - Etiquetas ya no vive en el CCP: /etiquetas redirige al hub', async ({
  page,
}) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await expect(page).not.toHaveURL(/\/etiquetas/);
  await expect(page.getByText(/Impresión Masiva de Etiquetas/i)).toHaveCount(0);
});

// ==========================================
// 4. GESTIÓN PATRIMONIAL Y ESTRUCTURA
// ==========================================

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

// La Impresión Masiva de Etiquetas (Mejora 2 / RF-F) se extrajo del CCP el 2026-09-13 (Fase 5 de
// la reestructuración CCP/CIP) a un programa de escritorio standalone, de uso interno del equipo
// SICSAFT: herramientas/generador-qr/. /etiquetas ya no es una ruta del CCP — ver el guard test
// "08c" más arriba, mismo criterio que el de /cip y /activos.

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
