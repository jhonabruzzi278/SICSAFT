/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Pool } from 'pg';
import { EventoRepository } from './evento.repository';

function buildPool(): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  } as unknown as jest.Mocked<Pool>;
}

describe('EventoRepository', () => {
  it('inserta el evento con detalle serializado a JSON', async () => {
    const pool = buildPool();
    const repository = new EventoRepository(pool);

    await repository.registrar({
      activoId: 'activo-1',
      tipo: 'escaneo_qr',
      usuario: 'op-1',
      detalle: { resultado: 'correcto' },
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      expect.any(String),
      'activo-1',
      'escaneo_qr',
      'op-1',
      '{"resultado":"correcto"}',
    ]);
  });

  it('inserta sin usuario ni detalle usando null', async () => {
    const pool = buildPool();
    const repository = new EventoRepository(pool);

    await repository.registrar({ activoId: 'activo-1', tipo: 'traslado' });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      expect.any(String),
      'activo-1',
      'traslado',
      null,
      null,
    ]);
  });

  describe('registrarContrato', () => {
    it('inserta el evento sin activo asociado, con detalle serializado a JSON', async () => {
      const pool = buildPool();
      const repository = new EventoRepository(pool);

      await repository.registrarContrato({
        contratoId: 'contrato-1',
        tipo: 'contrato_actualizado',
        usuario: 'op-admin',
        detalle: { estadoNuevo: 'vigente' },
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        expect.any(String),
        'contrato-1',
        'contrato_actualizado',
        'op-admin',
        '{"estadoNuevo":"vigente"}',
      ]);
    });

    it('inserta sin usuario ni detalle usando null', async () => {
      const pool = buildPool();
      const repository = new EventoRepository(pool);

      await repository.registrarContrato({
        contratoId: 'contrato-1',
        tipo: 'contrato_actualizado',
      });

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        expect.any(String),
        'contrato-1',
        'contrato_actualizado',
        null,
        null,
      ]);
    });
  });
});
