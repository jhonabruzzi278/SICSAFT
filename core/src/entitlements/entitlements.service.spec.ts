import { EntitlementsService } from './entitlements.service';
import type { ContratoRepository } from './contrato.repository';
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

function buildService(contratos: Contrato[]): EntitlementsService {
  const contratoRepository = {
    findAll: jest.fn().mockResolvedValue(contratos),
  } as unknown as jest.Mocked<ContratoRepository>;
  return new EntitlementsService(contratoRepository);
}

describe('EntitlementsService', () => {
  const ahora = new Date('2026-06-01T00:00:00.000Z');

  it('devuelve las organizaciones con contrato vigente para el modulo inventario-qr', async () => {
    const service = buildService([
      buildContrato({
        id: 'contrato-duoc-uc-melipilla',
        organizacionId: 'duoc-uc',
        organizacionNombre: 'DUOC UC',
        sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      }),
    ]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(1);
    expect(result.organizaciones[0]).toEqual({
      id: 'duoc-uc',
      nombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    });
  });

  it('no filtra por operadorId todavia — cualquier operador ve el mismo resultado (DOC-004 7)', async () => {
    const service = buildService([buildContrato()]);

    const primero = await service.resolve('op-1', ahora);
    const segundo = await service.resolve('otro-operador-cualquiera', ahora);

    expect(segundo).toEqual(primero);
  });

  it('incluye un contrato vigente dentro de su ventana de vigencia', async () => {
    const service = buildService([buildContrato()]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(1);
  });

  it('excluye un contrato suspendido', async () => {
    const service = buildService([buildContrato({ estado: 'suspendido' })]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('excluye un contrato cancelado', async () => {
    const service = buildService([buildContrato({ estado: 'cancelado' })]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('excluye un contrato cuya vigenciaDesde todavia no llega', async () => {
    const service = buildService([
      buildContrato({ vigenciaDesde: '2027-01-01T00:00:00.000Z' }),
    ]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('excluye un contrato vencido por vigenciaHasta, aunque el campo estado diga "vigente"', async () => {
    const service = buildService([
      buildContrato({ vigenciaHasta: '2026-01-01T00:00:00.000Z' }),
    ]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('incluye un contrato justo en el limite de vigenciaHasta', async () => {
    const service = buildService([
      buildContrato({ vigenciaHasta: ahora.toISOString() }),
    ]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(1);
  });

  it('excluye contratos vigentes que no incluyen el modulo inventario-qr', async () => {
    const service = buildService([buildContrato({ modulosContratados: [] })]);

    const result = await service.resolve('op-1', ahora);

    expect(result.organizaciones).toHaveLength(0);
  });

  it('usa la hora actual por defecto si no se especifica `ahora`', async () => {
    const service = buildService([buildContrato()]);

    const result = await service.resolve('op-1');

    expect(result.organizaciones).toHaveLength(1);
  });
});
