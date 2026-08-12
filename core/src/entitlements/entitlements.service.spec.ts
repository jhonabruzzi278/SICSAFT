import { EntitlementsService } from './entitlements.service';
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

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  const ahora = new Date('2026-06-01T00:00:00.000Z');

  beforeEach(() => {
    service = new EntitlementsService();
  });

  it('devuelve las organizaciones con contrato vigente para el modulo inventario-qr (seed real)', () => {
    const result = service.resolve('op-1');

    expect(result.organizaciones).toHaveLength(1);
    expect(result.organizaciones[0]).toEqual({
      id: 'duoc-uc',
      nombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    });
  });

  it('no filtra por operadorId todavia — cualquier operador ve el mismo resultado (DOC-004 §7)', () => {
    const primero = service.resolve('op-1');
    const segundo = service.resolve('otro-operador-cualquiera');

    expect(segundo).toEqual(primero);
  });

  it('incluye un contrato vigente dentro de su ventana de vigencia', () => {
    const contratos = [buildContrato()];

    const result = service.resolve('op-1', ahora, contratos);

    expect(result.organizaciones).toHaveLength(1);
  });

  it('excluye un contrato suspendido', () => {
    const contratos = [buildContrato({ estado: 'suspendido' })];

    const result = service.resolve('op-1', ahora, contratos);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('excluye un contrato cancelado', () => {
    const contratos = [buildContrato({ estado: 'cancelado' })];

    const result = service.resolve('op-1', ahora, contratos);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('excluye un contrato cuya vigenciaDesde todavia no llega', () => {
    const contratos = [
      buildContrato({ vigenciaDesde: '2027-01-01T00:00:00.000Z' }),
    ];

    const result = service.resolve('op-1', ahora, contratos);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('excluye un contrato vencido por vigenciaHasta, aunque el campo estado diga "vigente"', () => {
    const contratos = [
      buildContrato({ vigenciaHasta: '2026-01-01T00:00:00.000Z' }),
    ];

    const result = service.resolve('op-1', ahora, contratos);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('incluye un contrato justo en el limite de vigenciaHasta', () => {
    const contratos = [buildContrato({ vigenciaHasta: ahora.toISOString() })];

    const result = service.resolve('op-1', ahora, contratos);

    expect(result.organizaciones).toHaveLength(1);
  });

  it('excluye contratos vigentes que no incluyen el modulo inventario-qr', () => {
    const contratos = [buildContrato({ modulosContratados: [] })];

    const result = service.resolve('op-1', ahora, contratos);

    expect(result.organizaciones).toHaveLength(0);
  });
});
