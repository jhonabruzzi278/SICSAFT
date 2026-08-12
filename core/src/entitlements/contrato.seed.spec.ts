import {
  SEED_CONTRATOS,
  assertInvarianteSedeUnContratoVigente,
} from './contrato.seed';
import type { Contrato } from './contrato.types';

function buildContrato(overrides: Partial<Contrato> = {}): Contrato {
  return {
    id: 'contrato-x',
    organizacionId: 'org-x',
    organizacionNombre: 'Org X',
    sedes: [{ id: 'sede-x', nombre: 'Sede X' }],
    vigenciaDesde: '2026-01-01T00:00:00.000Z',
    vigenciaHasta: null,
    estado: 'vigente',
    modulosContratados: ['inventario-qr'],
    ...overrides,
  };
}

describe('assertInvarianteSedeUnContratoVigente', () => {
  it('no lanza para el seed real', () => {
    expect(() =>
      assertInvarianteSedeUnContratoVigente(SEED_CONTRATOS),
    ).not.toThrow();
  });

  it('no lanza cuando cada sede tiene un solo contrato vigente', () => {
    const contratos = [
      buildContrato({ id: 'c1', sedes: [{ id: 's1', nombre: 'S1' }] }),
      buildContrato({ id: 'c2', sedes: [{ id: 's2', nombre: 'S2' }] }),
    ];
    expect(() =>
      assertInvarianteSedeUnContratoVigente(contratos),
    ).not.toThrow();
  });

  it('lanza cuando dos contratos vigentes cubren la misma sede', () => {
    const contratos = [
      buildContrato({ id: 'c1', sedes: [{ id: 's1', nombre: 'S1' }] }),
      buildContrato({ id: 'c2', sedes: [{ id: 's1', nombre: 'S1' }] }),
    ];
    expect(() => assertInvarianteSedeUnContratoVigente(contratos)).toThrow(
      /s1/,
    );
  });

  it('ignora contratos no vigentes al validar el invariante', () => {
    const contratos = [
      buildContrato({
        id: 'c1',
        sedes: [{ id: 's1', nombre: 'S1' }],
        estado: 'cancelado',
      }),
      buildContrato({ id: 'c2', sedes: [{ id: 's1', nombre: 'S1' }] }),
    ];
    expect(() =>
      assertInvarianteSedeUnContratoVigente(contratos),
    ).not.toThrow();
  });
});
