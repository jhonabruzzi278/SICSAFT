import { calcularVeredicto } from './veredicto';

describe('calcularVeredicto', () => {
  it('exitoso cuando no falta nada ni hay fuera de área', () => {
    expect(calcularVeredicto(0, 0)).toBe('exitoso');
  });

  it('aceptable cuando solo faltan ítems', () => {
    expect(calcularVeredicto(3, 0)).toBe('aceptable');
  });

  it('aceptable cuando solo hay ítems fuera de área', () => {
    expect(calcularVeredicto(0, 2)).toBe('aceptable');
  });

  it('defectuoso cuando faltan ítems y hay fuera de área a la vez', () => {
    expect(calcularVeredicto(1, 1)).toBe('defectuoso');
  });
});
