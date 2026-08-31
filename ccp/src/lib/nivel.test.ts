import { afterEach, describe, expect, it } from 'vitest';
import { moduloHabilitado, nivelActual } from './nivel';

declare global {
  interface Window {
    __SICSAFT_PORTAL_CONFIG__?: Record<string, string>;
  }
}

afterEach(() => {
  delete window.__SICSAFT_PORTAL_CONFIG__;
});

describe('nivelActual', () => {
  it('devuelve 1 cuando el .exe inyecta VITE_SICSAFT_NIVEL="1"', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: '1' };
    expect(nivelActual()).toBe(1);
  });

  it('devuelve 2 cuando el .exe inyecta VITE_SICSAFT_NIVEL="2"', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: '2' };
    expect(nivelActual()).toBe(2);
  });

  it('cae a 2 sin config inyectada ni env var (dev / standalone)', () => {
    expect(nivelActual()).toBe(2);
  });

  it('cae a 2 ante un valor inesperado', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: 'x' };
    expect(nivelActual()).toBe(2);
  });
});

describe('moduloHabilitado', () => {
  it('en Nivel 1 habilita consulta/inventario/dashboard/importaciones/auditoria', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: '1' };
    for (const path of [
      'dashboard',
      'activos',
      'inventarios',
      'importaciones',
      'auditoria',
      'etiquetas',
    ]) {
      expect(moduloHabilitado(path)).toBe(true);
    }
  });

  it('en Nivel 1 oculta contratos y estructura (gestion avanzada)', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: '1' };
    expect(moduloHabilitado('contratos')).toBe(false);
    expect(moduloHabilitado('estructura')).toBe(false);
  });

  it('en Nivel 2 habilita todo', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: '2' };
    expect(moduloHabilitado('contratos')).toBe(true);
    expect(moduloHabilitado('estructura')).toBe(true);
  });
});
