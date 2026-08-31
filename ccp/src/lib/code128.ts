// DOC-029 RF-F — generador de código de barras Code 128-B, sin dependencia (mismo criterio que
// icons.tsx / ui.tsx: no sumar una lib para algo acotado). Devuelve las barras negras ya
// posicionadas en módulos (ancho 1 por módulo); el componente las pinta como <rect> en un <svg>.
//
// Code 128-B cubre ASCII 32..126 — suficiente para los códigos patrimoniales del ecosistema
// (`^[A-Z0-9]+(-[A-Z0-9]+)?$`, ver core/src/reglas/clasificar-escaneo.ts). Un carácter fuera de
// rango tira: el llamador cae a mostrar el código como texto.

// Tabla canónica de patrones Code 128 (índice = valor del símbolo; cada patrón = anchos
// barra/espacio alternados, empezando por barra). 0..102 = datos, 103..105 = Start A/B/C,
// 106 = Stop.
const PATRONES = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
] as const;

const START_B = 104;
const STOP = 106;
const ASCII_BASE = 32;
const ASCII_MAX = 126;

export interface Barra {
  x: number;
  ancho: number;
}

export interface Code128 {
  /** Ancho total en módulos (1 módulo = la barra más fina). */
  modulos: number;
  /** Barras negras, ya posicionadas. */
  barras: Barra[];
}

export function code128b(texto: string): Code128 {
  if (texto.length === 0) {
    throw new Error('Code 128 necesita al menos un carácter.');
  }

  const valores: number[] = [START_B];
  for (const ch of texto) {
    const code = ch.charCodeAt(0);
    if (code < ASCII_BASE || code > ASCII_MAX) {
      throw new Error(
        `Carácter fuera del rango Code 128-B (ASCII 32..126): "${ch}".`,
      );
    }
    valores.push(code - ASCII_BASE);
  }

  // Checksum ponderado: (start + Σ valor_i * posición_i) mod 103, posición desde 1.
  let suma = START_B;
  for (let i = 1; i < valores.length; i++) {
    suma += valores[i] * i;
  }
  valores.push(suma % 103);
  valores.push(STOP);

  const barras: Barra[] = [];
  let x = 0;
  for (const valor of valores) {
    const patron = PATRONES[valor];
    for (let i = 0; i < patron.length; i++) {
      const ancho = Number(patron[i]);
      if (i % 2 === 0) barras.push({ x, ancho }); // índice par = barra negra
      x += ancho;
    }
  }
  return { modulos: x, barras };
}
