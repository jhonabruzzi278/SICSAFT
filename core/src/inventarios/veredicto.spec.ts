import { calcularVeredicto } from './veredicto';

describe('core: calcularVeredicto (Contrato Canónico)', () => {
  it('Caso 1: exitoso cuando no falta nada ni hay fuera de área (0, 0)', () => {
    expect(calcularVeredicto(0, 0)).toBe('exitoso');
  });

  it('Caso 2: aceptable cuando solo faltan ítems (faltantes > 0, fueraDeArea = 0)', () => {
    expect(calcularVeredicto(1, 0)).toBe('aceptable');
    expect(calcularVeredicto(3, 0)).toBe('aceptable');
    expect(calcularVeredicto(100, 0)).toBe('aceptable');
  });

  it('Caso 3: aceptable cuando solo hay ítems fuera de área (faltantes = 0, fueraDeArea > 0)', () => {
    expect(calcularVeredicto(0, 1)).toBe('aceptable');
    expect(calcularVeredicto(0, 2)).toBe('aceptable');
    expect(calcularVeredicto(0, 50)).toBe('aceptable');
  });

  it('Caso 4: defectuoso cuando faltan ítems y hay fuera de área a la vez (>0, >0)', () => {
    expect(calcularVeredicto(1, 1)).toBe('defectuoso');
    expect(calcularVeredicto(10, 5)).toBe('defectuoso');
  });
});
