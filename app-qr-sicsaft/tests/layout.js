// Aserciones de layout medibles para la PWA (DOC-031 §4 Fase 1.bis).
//
// El operador usa esta app parado en una oficina, con el teléfono en una mano y una etiqueta en la
// otra. "Que no haya que hacer scroll" y "que nada quede tapado" no son criterios de estilo: son
// requisitos de uso. Acá se vuelven número, para que una regresión de layout falle en CI en vez de
// descubrirse en la visita al cliente.

/** Los tres tamaños contra los que se valida. El primero es el piso realista de gama baja. */
export const VIEWPORTS = [
  { nombre: '360x640 (gama baja)', width: 360, height: 640 },
  { nombre: '375x812 (referencia)', width: 375, height: 812 },
  { nombre: '414x896 (grande)', width: 414, height: 896 },
];

/**
 * Alto real del documento vs. el visible, y lo mismo a lo ancho. `exceso > 0` ⇒ la página entera
 * scrollea; `excesoH > 0` ⇒ scrollea de costado, que en un teléfono es siempre un defecto (una
 * etiqueta que no entra, un `flex-1` sin `min-w-0`).
 */
export async function medirScroll(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollH: doc.scrollHeight,
      viewportH: window.innerHeight,
      exceso: doc.scrollHeight - window.innerHeight,
      excesoH: doc.scrollWidth - doc.clientWidth,
    };
  });
}

/**
 * ¿Hay algo dibujado ENCIMA del elemento en su propio centro? Es la forma de atrapar la bottom nav
 * fija y el FAB tapando botones o filas: `getBoundingClientRect` los ve perfectos, pero el dedo
 * del operador toca lo que está arriba.
 *
 * Devuelve `{ tapado: false }`, `{ tapado: true, por }` o `{ fuera: true }` si el centro del
 * elemento cae fuera del viewport (⇒ inalcanzable sin scrollear).
 */
export async function inspeccionarOclusion(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { error: `no existe ${sel}` };
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { error: `${sel} no tiene tamaño` };

    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth) {
      return { fuera: true, y, viewportH: window.innerHeight };
    }

    const encima = document.elementFromPoint(x, y);
    if (!encima) return { error: 'elementFromPoint devolvió null' };
    if (el.contains(encima) || encima.contains(el)) return { tapado: false };

    const quien =
      encima.getAttribute('data-testid') ||
      (typeof encima.className === 'string' ? encima.className : '') ||
      encima.tagName;
    return { tapado: true, por: String(quien).slice(0, 90) };
  }, selector);
}

/** Alto de una fila de la lista de escaneados — cuántas entran por pantalla. */
export async function medirFila(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().height);
  }, selector);
}

/** Cuántos contenedores distintos scrollean a la vez (scroll anidado = el dedo no sabe qué mueve). */
export async function contarZonasScrolleables(page) {
  return page.evaluate(() => {
    const zonas = [];
    const doc = document.documentElement;
    if (doc.scrollHeight > doc.clientHeight + 2) zonas.push('documento');
    for (const el of document.querySelectorAll('*')) {
      if (el === doc || el === document.body) continue;
      const s = getComputedStyle(el);
      const puede = /auto|scroll/.test(s.overflowY);
      if (puede && el.scrollHeight > el.clientHeight + 2) {
        zonas.push(el.getAttribute('data-testid') || el.tagName.toLowerCase());
      }
    }
    return zonas;
  });
}
