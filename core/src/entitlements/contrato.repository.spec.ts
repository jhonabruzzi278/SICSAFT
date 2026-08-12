import type { Pool } from 'pg';
import { ContratoRepository } from './contrato.repository';

function buildPool(rows: unknown[]): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as jest.Mocked<Pool>;
}

describe('ContratoRepository', () => {
  it('mapea filas de postgres a Contrato[], incluyendo fechas ISO y sedes anidadas', async () => {
    const pool = buildPool([
      {
        id: 'contrato-duoc-uc-melipilla',
        organizacionId: 'duoc-uc',
        organizacionNombre: 'DUOC UC',
        vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
        vigenciaHasta: null,
        estado: 'vigente',
        modulosContratados: ['inventario-qr'],
        sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      },
    ]);
    const repository = new ContratoRepository(pool);

    const contratos = await repository.findAll();

    expect(contratos).toEqual([
      {
        id: 'contrato-duoc-uc-melipilla',
        organizacionId: 'duoc-uc',
        organizacionNombre: 'DUOC UC',
        sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
        vigenciaDesde: '2026-01-01T00:00:00.000Z',
        vigenciaHasta: null,
        estado: 'vigente',
        modulosContratados: ['inventario-qr'],
      },
    ]);
  });

  it('mapea vigenciaHasta no nula a ISO string', async () => {
    const pool = buildPool([
      {
        id: 'contrato-x',
        organizacionId: 'org-x',
        organizacionNombre: 'Org X',
        vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
        vigenciaHasta: new Date('2026-12-31T00:00:00.000Z'),
        estado: 'vencido',
        modulosContratados: [],
        sedes: [],
      },
    ]);
    const repository = new ContratoRepository(pool);

    const [contrato] = await repository.findAll();

    expect(contrato.vigenciaHasta).toBe('2026-12-31T00:00:00.000Z');
  });

  it('lanza si los datos leidos violan el invariante DOC-004 §4 (sede con mas de un contrato vigente)', async () => {
    const filaBase = {
      organizacionId: 'org-x',
      organizacionNombre: 'Org X',
      vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenciaHasta: null,
      estado: 'vigente' as const,
      modulosContratados: ['inventario-qr'] as const,
      sedes: [{ id: 'sede-1', nombre: 'Sede 1' }],
    };
    const pool = buildPool([
      { ...filaBase, id: 'contrato-1' },
      { ...filaBase, id: 'contrato-2' },
    ]);
    const repository = new ContratoRepository(pool);

    await expect(repository.findAll()).rejects.toThrow(/sede-1/);
  });
});
