import { describe, expect, it } from 'vitest';
import { estiloVeredicto, etiquetaTipo, formatPorcentaje } from './pantalla-8';

describe('estiloVeredicto', () => {
  it('mapea cada veredicto a su etiqueta y fondo', () => {
    expect(estiloVeredicto('exitoso').etiqueta).toBe('EXITOSO');
    expect(estiloVeredicto('exitoso').fondo).toContain('success');
    expect(estiloVeredicto('aceptable').etiqueta).toBe('ACEPTABLE');
    expect(estiloVeredicto('aceptable').fondo).toContain('warning');
    expect(estiloVeredicto('defectuoso').etiqueta).toBe('DEFECTUOSO');
    expect(estiloVeredicto('defectuoso').fondo).toContain('destructive');
  });
});

describe('formatPorcentaje', () => {
  it('convierte la fracción a porcentaje CL con una decimal', () => {
    expect(formatPorcentaje(0.5)).toBe('50 %');
    expect(formatPorcentaje(0.333)).toBe('33,3 %');
    expect(formatPorcentaje(1)).toBe('100 %');
  });

  it('acota fuera de [0,1]', () => {
    expect(formatPorcentaje(0)).toBe('0 %');
    expect(formatPorcentaje(-0.2)).toBe('0 %');
    expect(formatPorcentaje(1.5)).toBe('100 %');
  });
});

describe('etiquetaTipo', () => {
  it('ordinario/extraordinario/null', () => {
    expect(etiquetaTipo('ordinario')).toBe('ORDINARIO');
    expect(etiquetaTipo('extraordinario')).toBe('EXTRAORDINARIO');
    expect(etiquetaTipo(null)).toBe('—');
  });
});
