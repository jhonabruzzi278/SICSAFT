import { describe, expect, it } from 'vitest';
import { code128b } from './code128';

describe('code128b', () => {
  it('codifica "DG-001" con el checksum y el stop correctos', () => {
    const { modulos, barras } = code128b('DG-001');
    // Start B + 6 datos + checksum = 8 símbolos * 11 módulos + stop (13) = 101 módulos.
    expect(modulos).toBe(101);
    // La primera barra siempre arranca en x=0 (Start B = patrón 211214).
    expect(barras[0]).toEqual({ x: 0, ancho: 2 });
    // Todas las barras dentro del ancho total.
    for (const b of barras) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.ancho).toBeLessThanOrEqual(modulos);
    }
  });

  it('el checksum de "CODE128" da el símbolo esperado', () => {
    // Valores C,O,D,E,1,2,8 = 35,47,36,37,17,18,24; start B = 104.
    // suma = 104 + 35*1 + 47*2 + 36*3 + 37*4 + 17*5 + 18*6 + 24*7 = 104+35+94+108+148+85+108+168 = 850
    // 850 % 103 = 22  -> patrón índice 22 = "223112" -> primera barra ancho 2.
    const { barras } = code128b('CODE128');
    // Reconstituir la posición de arranque del símbolo de checksum: start(6) + 7*6 = 48 módulos.
    const inicioChecksum = 6 + 7 * 6;
    const barraChecksum = barras.find((b) => b.x === inicioChecksum);
    expect(barraChecksum).toEqual({ x: inicioChecksum, ancho: 2 });
  });

  it('rechaza una cadena vacía', () => {
    expect(() => code128b('')).toThrow(/al menos un carácter/);
  });

  it('rechaza un carácter fuera del rango Code 128-B', () => {
    expect(() => code128b('AÑO')).toThrow(/fuera del rango/);
  });

  it('las barras nunca se solapan y avanzan monótonamente', () => {
    const { barras } = code128b('DG-042');
    for (let i = 1; i < barras.length; i++) {
      expect(barras[i].x).toBeGreaterThanOrEqual(
        barras[i - 1].x + barras[i - 1].ancho,
      );
    }
  });
});
