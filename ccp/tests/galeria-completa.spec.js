import { test } from '@playwright/test';
import { seedAuth } from './helpers.js';

// Suite de Capturas Visuales Completas de Alta Resolución (1440x900)
// Documenta el 100% de los flujos solicitados por el usuario:
//  - Paso a paso de instalación y registro de organización (Pasos 1 al 4)
//  - Portales, Logins, Hub Multi-organización
//  - Centro de Inteligencia Patrimonial (CIP) Nivel 2 en detalle
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
  await page.screenshot({ path: `${OUT}/01-wizard-paso-1-datos-organizacion.png`, fullPage: true });
});

test('02 - Wizard: Alta del Director y Contraseña Temporal', async ({ page }) => {
  await page.goto('/wizard-preview?paso=2');
  await page.waitForSelector('h1:has-text("Director dado de alta")');
  await page.screenshot({ path: `${OUT}/02-wizard-paso-2-alta-director.png`, fullPage: true });
});

test('03 - Wizard: Alta del Profesional AFT', async ({ page }) => {
  await page.goto('/wizard-preview?paso=3');
  await page.waitForSelector('h1:has-text("Profesional de AFT dado de alta")');
  await page.screenshot({ path: `${OUT}/03-wizard-paso-3-alta-aft.png`, fullPage: true });
});

test('04 - Wizard: Instalación Completa con Acceso Móvil QR Dual', async ({ page }) => {
  await page.goto('/wizard-preview?paso=4');
  await page.waitForSelector('h1:has-text("Instalación completa")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/04-wizard-paso-4-instalacion-completa-qr.png`, fullPage: true });
});

// ==========================================
// 2. LOGINS Y HUB
// ==========================================

test('05 - Login del Portal SICSAFT', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('button:has-text("Iniciar sesión")');
  await page.screenshot({ path: `${OUT}/05-login-portal-sicsaft.png`, fullPage: true });
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
  await page.screenshot({ path: `${OUT}/06-hub-organizaciones-sedes.png`, fullPage: true });
});

// ==========================================
// 3. CENTRO DE INTELIGENCIA PATRIMONIAL (CIP)
// ==========================================

test('07 - CCP Resumen Operativo con Botón Destacado al CIP', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/dashboard?organizacionId=duoc-uc');
  await page.waitForSelector('h1:has-text("Resumen Operativo")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/07-ccp-resumen-operativo-boton-cip.png`, fullPage: true });
});

test('08 - CIP Web Interactiva: 4 Stat Cards, Donut Chart y Bar Chart SVG', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/cip?organizacionId=duoc-uc');
  await page.waitForSelector('h1:has-text("Resumen Ejecutivo")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/08-cip-dashboard-categorias-svg.png`, fullPage: false });
});

test('09 - CIP Web Interactiva: Activos Recientes y Matriz de Valor', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/cip?organizacionId=duoc-uc');
  await page.waitForSelector('text=Activos Recientes');
  // Abrir la Matriz de Valor
  const btnMatriz = page.locator('button:has-text("Matriz de Valor")');
  if (await btnMatriz.isVisible()) {
    await btnMatriz.click();
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/09-cip-activos-recientes-y-matriz-valor.png`, fullPage: true });
});

// ==========================================
// 4. GESTIÓN PATRIMONIAL Y ESTRUCTURA
// ==========================================

test('10 - CCP: Catálogo de Activos Fijos', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/activos?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Crear activo")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/10-ccp-catalogo-activos.png`, fullPage: true });
});

test('11 - CCP: Estructura Patrimonial (Áreas y Dependencias)', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/estructura?organizacionId=duoc-uc');
  await page.waitForSelector('text=Áreas');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/11-ccp-estructura-patrimonial.png`, fullPage: true });
});

// ==========================================
// 5. MEJORA 2: IMPRESIÓN MASIVA DE ETIQUETAS
// ==========================================

test('12 - Mejora 2: Etiquetas Masivas - Plantilla Avery 5160 (3x10)', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('text=Impresión Masiva de Etiquetas');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/12-ccp-etiquetas-plantilla-avery.png`, fullPage: true });
});

test('13 - Mejora 2: Etiquetas Masivas - Plantilla Tarjetas de Inventario (2x5)', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Tarjetas 2×5")');
  await page.getByRole('button', { name: 'Tarjetas 2×5' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/13-ccp-etiquetas-plantilla-tarjetas.png`, fullPage: true });
});

test('14 - Mejora 2: Etiquetas Masivas - Plantilla Rollo Térmico (1x1)', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Térmica 1×1")');
  await page.getByRole('button', { name: 'Térmica 1×1' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/14-ccp-etiquetas-plantilla-termica.png`, fullPage: true });
});

test('15 - Mejora 2: Etiquetas Masivas - Simulación de Hoja de Papel Troquelada', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/etiquetas?organizacionId=duoc-uc');
  await page.waitForSelector('button:has-text("Simular Papel")');
  await page.getByRole('button', { name: 'Simular Papel' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/15-ccp-etiquetas-simulacion-papel.png`, fullPage: true });
});

// ==========================================
// 6. MEJORA 6: INGESTA EXCEL CON DIFF VISUAL
// ==========================================

test('16 - Mejora 6: Ingesta Excel - Zona Drag & Drop', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/importaciones?organizacionId=duoc-uc');
  await page.waitForSelector('text=Ingesta Directa con Diff Visual');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/16-ccp-importaciones-dropzone.png`, fullPage: true });
});

test('17 - Mejora 6: Ingesta Excel - Diff Visual Interactivo con Diagnóstico', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/importaciones?organizacionId=duoc-uc');
  await page.waitForSelector('text=Ingesta Directa con Diff Visual');

  // Cargar una planilla de prueba simulada directamente por el input file
  const csvPrueba = [
    'codigoPatrimonial,codigoQr,catalogoId,serie,areaId,ubicacionId,valorPatrimonial',
    'NOTE-NUEVO-01,QR-NOTE-NUEVO-01,catalogo-notebook,SN-N1,area-informatica,ubi-1,950000',
    'NOTE-NUEVO-02,QR-NOTE-NUEVO-02,catalogo-notebook,SN-N2,area-informatica,ubi-1,950000',
    'activo-notebook-001,QR-NOTEBOOK-001,catalogo-notebook,SN-EX1,area-biblioteca,ubi-bib-1,800000',
    'activo-proyector-002,QR-PROYECTOR-002,catalogo-notebook,SN-EX2,area-informatica,ubicacion-lab-1,450000',
    'CONFLICTO-01,QR-ESCANER-003,catalogo-notebook,SN-C1,area-informatica,ubi-1,300000',
  ].join('\n');

  await page.setInputFiles('input[type="file"]', {
    name: 'inventario-activos-2026.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvPrueba),
  });

  await page.waitForSelector('text=Total Filas');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/17-ccp-importaciones-diff-visual.png`, fullPage: true });
});

// ==========================================
// 7. AUDITORÍA BPI
// ==========================================

test('18 - CCP: Auditoría y Trazabilidad Transversal de la BPI', async ({ page }) => {
  await seedAuth(page);
  await page.goto('/auditoria?organizacionId=duoc-uc');
  await page.waitForSelector('h1:has-text("Auditoría")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/18-ccp-auditoria-trazabilidad.png`, fullPage: true });
});
