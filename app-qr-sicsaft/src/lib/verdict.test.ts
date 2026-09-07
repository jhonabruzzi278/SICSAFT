import { describe, expect, it } from 'vitest';
import { calcularVeredicto, VERDICT_LABEL, Verdict } from './verdict';

describe('app-qr-sicsaft: calcularVeredicto (Contrato Canónico)', () => {
  it('Caso 1: exitoso cuando no hay faltantes ni bienes fuera de área (0, 0)', () => {
    expect(calcularVeredicto(0, 0)).toBe('exitoso');
  });

  it('Caso 2: aceptable cuando solo hay faltantes (missing > 0, outOfPlace = 0)', () => {
    expect(calcularVeredicto(1, 0)).toBe('aceptable');
    expect(calcularVeredicto(42, 0)).toBe('aceptable');
  });

  it('Caso 3: aceptable cuando solo hay bienes fuera de área (missing = 0, outOfPlace > 0)', () => {
    expect(calcularVeredicto(0, 1)).toBe('aceptable');
    expect(calcularVeredicto(0, 15)).toBe('aceptable');
  });

  it('Caso 4: defectuoso cuando hay faltantes y bienes fuera de área a la vez (>0, >0)', () => {
    expect(calcularVeredicto(1, 1)).toBe('defectuoso');
    expect(calcularVeredicto(5, 3)).toBe('defectuoso');
  });

  it('Mapea correctamente las etiquetas legibles en VERDICT_LABEL', () => {
    const estados: Verdict[] = ['exitoso', 'aceptable', 'defectuoso'];
    estados.forEach((estado) => {
      expect(VERDICT_LABEL[estado]).toBeDefined();
      expect(typeof VERDICT_LABEL[estado]).toBe('string');
      expect(VERDICT_LABEL[estado].length).toBeGreaterThan(0);
    });

    expect(VERDICT_LABEL.exitoso).toBe('Exitoso');
    expect(VERDICT_LABEL.aceptable).toBe('Aceptable');
    expect(VERDICT_LABEL.defectuoso).toBe('Defectuoso');
  });
});
