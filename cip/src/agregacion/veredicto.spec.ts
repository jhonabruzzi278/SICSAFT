import { calcularVeredicto } from './veredicto';

describe('calcularVeredicto', () => {
  it('exitoso cuando no falta nada y nada aparece fuera de área', () => {
    expect(calcularVeredicto(0, 0)).toBe('exitoso');
  });

  it('aceptable cuando falta algo pero nada aparece fuera de área', () => {
    expect(calcularVeredicto(2, 0)).toBe('aceptable');
  });

  it('aceptable cuando aparece algo fuera de área pero no falta nada', () => {
    expect(calcularVeredicto(0, 1)).toBe('aceptable');
  });

  it('defectuoso cuando faltan cosas y además aparece algo fuera de área', () => {
    expect(calcularVeredicto(3, 1)).toBe('defectuoso');
  });
});
