import { calcularVeredicto } from './veredicto';

describe('cip: calcularVeredicto (Contrato Canónico)', () => {
  it('Caso 1: exitoso cuando no falta nada y nada aparece fuera de área (0, 0)', () => {
    expect(calcularVeredicto(0, 0)).toBe('exitoso');
  });

  it('Caso 2: defectuoso cuando falta algo aunque nada aparezca fuera de área (faltantes > 0, fueraDeArea = 0)', () => {
    expect(calcularVeredicto(1, 0)).toBe('defectuoso');
    expect(calcularVeredicto(2, 0)).toBe('defectuoso');
    expect(calcularVeredicto(99, 0)).toBe('defectuoso');
  });

  it('Caso 3: aceptable cuando aparece algo fuera de área pero no falta nada (faltantes = 0, fueraDeArea > 0)', () => {
    expect(calcularVeredicto(0, 1)).toBe('aceptable');
    expect(calcularVeredicto(0, 4)).toBe('aceptable');
    expect(calcularVeredicto(0, 75)).toBe('aceptable');
  });

  it('Caso 4: defectuoso cuando faltan cosas y además aparece algo fuera de área (>0, >0)', () => {
    expect(calcularVeredicto(1, 1)).toBe('defectuoso');
    expect(calcularVeredicto(3, 1)).toBe('defectuoso');
    expect(calcularVeredicto(8, 6)).toBe('defectuoso');
  });
});
