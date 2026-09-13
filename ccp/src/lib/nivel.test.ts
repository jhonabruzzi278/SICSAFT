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
  it('en Nivel 1 el CCP esta completo: dashboard operativo, estructura, importaciones, auditoria', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: '1' };
    for (const path of [
      'dashboard',
      'estructura',
      'importaciones',
      'auditoria',
    ]) {
      expect(moduloHabilitado(path)).toBe(true);
    }
  });

  it('activos se mudo al CIP (Fase 3) — ya no es un modulo del CCP en ningun nivel', () => {
    for (const nivel of ['1', '2']) {
      window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: nivel };
      expect(moduloHabilitado('activos')).toBe(false);
    }
  });

  it('el CIP no es un modulo del CCP en ningun nivel — vive en el portal del Directivo', () => {
    for (const nivel of ['1', '2']) {
      window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: nivel };
      expect(moduloHabilitado('cip')).toBe(false);
    }
  });

  it('en Nivel 2 el CCP muestra exactamente los mismos modulos que en Nivel 1', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: '2' };
    expect(moduloHabilitado('dashboard')).toBe(true);
    expect(moduloHabilitado('estructura')).toBe(true);
  });

  it('contratos esta retirado del CCP en cualquier nivel', () => {
    for (const nivel of ['1', '2']) {
      window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: nivel };
      expect(moduloHabilitado('contratos')).toBe(false);
    }
  });

  it('inventarios ("Controles de areas") se mudo al CIP (Fase 4) — ya no es un modulo del CCP en ningun nivel', () => {
    for (const nivel of ['1', '2']) {
      window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: nivel };
      expect(moduloHabilitado('inventarios')).toBe(false);
    }
  });

  it('etiquetas se extrajo a un programa externo (Fase 5) — ya no es un modulo del CCP en ningun nivel', () => {
    for (const nivel of ['1', '2']) {
      window.__SICSAFT_PORTAL_CONFIG__ = { VITE_SICSAFT_NIVEL: nivel };
      expect(moduloHabilitado('etiquetas')).toBe(false);
    }
  });
});
