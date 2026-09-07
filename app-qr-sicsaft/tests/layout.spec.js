import { test, expect } from '@playwright/test';
import { resetApp, scanCode } from './helpers.js';
import {
  VIEWPORTS,
  contarZonasScrolleables,
  inspeccionarOclusion,
  medirFila,
  medirScroll,
} from './layout.js';

// DOC-031 §4 Fase 1.bis — la app se usa parado en una oficina, con el teléfono en una mano.
// "No hay que hacer scroll para seguir escaneando" y "nada queda tapado por la barra de abajo"
// son requisitos de uso, no de estilo. Acá quedan como número.
//
// Medición del estado previo al rediseño (375x812), para que quede el antes/después:
//   escaneo 0 ítems  ->  812 (sin scroll)
//   escaneo 1 ítem   ->  930 (+118)   <- ya obligaba a scrollear
//   escaneo 2+ ítems -> 1090 (+278)
//   reporte          -> 1800 (+988, 2,22 pantallas)
//   fila escaneada   ->  166 px (tres botones full-width apilados) => 4,9 filas por pantalla

/** Deja la app en la pantalla de escaneo con `n` ítems ya cargados. */
async function escaneando(page, n) {
  await resetApp(page);
  await page.click('[data-testid="start-scan-btn"]');
  for (let i = 1; i <= n; i += 1) {
    await scanCode(page, `QR-${String(i).padStart(4, '0')}`);
  }
  if (n > 0) {
    await expect(page.locator('[data-testid="scanned-count"]')).toHaveText(String(n));
  }
}

for (const vp of VIEWPORTS) {
  test.describe(`layout ${vp.nombre}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('escanear no obliga a scrollear la página (la lista scrollea sola)', async ({ page }) => {
      await escaneando(page, 1);
      const conUno = await medirScroll(page);
      expect(
        conUno.exceso,
        `con 1 ítem la página mide ${conUno.scrollH} y la pantalla ${conUno.viewportH}`,
      ).toBeLessThanOrEqual(2);

      await escaneando(page, 20);
      const conVeinte = await medirScroll(page);
      expect(
        conVeinte.exceso,
        `con 20 ítems la página mide ${conVeinte.scrollH} y la pantalla ${conVeinte.viewportH}`,
      ).toBeLessThanOrEqual(2);
    });

    test('la pantalla no scrollea de costado', async ({ page }) => {
      // Un `flex-1` sin `min-w-0` con una etiqueta larga alcanza para meter scroll horizontal, y
      // a simple vista sólo se ve un texto cortado contra el borde.
      await escaneando(page, 6);
      const m = await medirScroll(page);
      expect(m.excesoH, `la página desborda ${m.excesoH}px a lo ancho`).toBeLessThanOrEqual(1);
    });

    test('scrollea una sola zona (sin scroll anidado)', async ({ page }) => {
      await escaneando(page, 20);
      const zonas = await contarZonasScrolleables(page);
      expect(zonas, `zonas que scrollean a la vez: ${zonas.join(', ')}`).toHaveLength(1);
      expect(zonas[0]).not.toBe('documento');
    });

    test('"Finalizar y ver reporte" queda alcanzable y sin nada encima', async ({ page }) => {
      await escaneando(page, 20);
      const oclusion = await inspeccionarOclusion(page, '[data-testid="finish-btn"]');
      expect(
        oclusion,
        `el botón de finalizar no es tocable: ${JSON.stringify(oclusion)}`,
      ).toEqual({ tapado: false });
    });

    test('el veredicto del reporte se ve sin scrollear y nada lo tapa', async ({ page }) => {
      await escaneando(page, 20);
      await page.click('[data-testid="finish-btn"]');
      await expect(page.locator('[data-testid="report-verdict"]')).toBeVisible();

      // El reporte SÍ puede scrollear (tiene detalle), pero el veredicto y los primeros
      // indicadores son lo que el AFT mira al cerrar el control: tienen que entrar sin mover nada.
      for (const sel of ['[data-testid="report-verdict"]', '[data-testid="report-total"]']) {
        const oclusion = await inspeccionarOclusion(page, sel);
        expect(oclusion, `${sel}: ${JSON.stringify(oclusion)}`).toEqual({ tapado: false });
      }
    });

    test('la barra inferior no tapa las acciones del reporte', async ({ page }) => {
      await escaneando(page, 3);
      await page.click('[data-testid="finish-btn"]');
      await page.locator('[data-testid="export-csv-btn"]').scrollIntoViewIfNeeded();
      for (const sel of ['[data-testid="export-csv-btn"]', '[data-testid="reset-btn"]']) {
        const oclusion = await inspeccionarOclusion(page, sel);
        expect(oclusion, `${sel}: ${JSON.stringify(oclusion)}`).toEqual({ tapado: false });
      }
    });
  });
}

// La lista de escaneados entra entera en su zona y scrollea sola (los tests de arriba lo
// garantizan), así que el alto de fila ya no obliga a scrollear la PÁGINA. Compactarla igual sería
// una mejora -- hoy una fila `unregistered` mide 166 px porque sus tres acciones envuelven en tres
// líneas -- pero no se hace acá: las etiquetas de esos botones son contrato de otras suites
// (`scan-classification` aserta 'Marcado fuera de lugar', `fase-3.1` aserta 'Editar sugerencia de
// baja') y esconderlas detrás de un disclosure rompería los tests que las clican. Queda como
// cambio propio, con su decisión de interacción explícita (DOC-031 §4 Fase 1.bis).
test('la lista de escaneados cabe en su zona sin desbordar la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await escaneando(page, 20);

  const alto = await medirFila(page, '[data-testid="scanned-item-code"]');
  expect(alto, 'no se encontró una fila escaneada').not.toBeNull();

  // El contenedor de la lista nunca puede pasarse del alto visible: si se pasa, vuelve el scroll
  // de página que este archivo existe para evitar.
  const lista = await page.evaluate(() => {
    const ul = document.querySelector('[data-testid="scanned-list"]');
    if (!ul) return null;
    const r = ul.getBoundingClientRect();
    return { alto: Math.round(r.height), viewportH: window.innerHeight, scrollea: ul.scrollHeight > ul.clientHeight + 2 };
  });
  expect(lista, 'no se encontró la lista').not.toBeNull();
  expect(lista.alto, `la lista mide ${lista.alto}px en una pantalla de ${lista.viewportH}px`).toBeLessThan(
    lista.viewportH,
  );
  expect(lista.scrollea, 'con 20 ítems la lista debería scrollear por dentro').toBe(true);
});
