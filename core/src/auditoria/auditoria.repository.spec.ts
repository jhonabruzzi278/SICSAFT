/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Pool } from 'pg';
import { AuditoriaRepository } from './auditoria.repository';

function buildPool(): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  } as unknown as jest.Mocked<Pool>;
}

describe('AuditoriaRepository', () => {
  it('inserta con todos los campos', async () => {
    const pool = buildPool();
    const repository = new AuditoriaRepository(pool);

    await repository.registrar({
      usuario: 'op-1',
      equipo: 'device-1',
      ip: '10.0.0.1',
      operacion: 'POST /inventarios',
      resultado: 'recibido',
      observaciones: 'ok',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      expect.any(String),
      'op-1',
      'device-1',
      '10.0.0.1',
      'POST /inventarios',
      'recibido',
      'ok',
    ]);
  });

  it('inserta usando null para los campos opcionales ausentes', async () => {
    const pool = buildPool();
    const repository = new AuditoriaRepository(pool);

    await repository.registrar({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'rechazado:409',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      expect.any(String),
      'op-1',
      null,
      null,
      'POST /inventarios',
      'rechazado:409',
      null,
    ]);
  });

  describe('listar', () => {
    function buildPoolPara(rows: unknown[], total: number): jest.Mocked<Pool> {
      return {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ total: String(total) }] }) // COUNT(*)
          .mockResolvedValueOnce({ rows }), // SELECT paginado
      } as unknown as jest.Mocked<Pool>;
    }

    it('devuelve las filas con fecha serializada a ISO y el total real (RNF-01, cierra el gap)', async () => {
      const fecha = new Date('2026-08-14T10:00:00.000Z');
      const pool = buildPoolPara(
        [
          {
            id: 'audit-1',
            usuario: 'op-1',
            fecha,
            equipo: null,
            ip: null,
            operacion: 'POST /inventarios',
            resultado: 'recibido',
            observaciones: null,
          },
        ],
        1,
      );
      const repository = new AuditoriaRepository(pool);

      const pagina = await repository.listar({ limit: 20, offset: 0 });

      expect(pagina.total).toBe(1);
      expect(pagina.entradas).toEqual([
        {
          id: 'audit-1',
          usuario: 'op-1',
          fecha: '2026-08-14T10:00:00.000Z',
          equipo: null,
          ip: null,
          operacion: 'POST /inventarios',
          resultado: 'recibido',
          observaciones: null,
        },
      ]);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [20, 0],
      );
    });

    it('filtra por usuario y operacion con ILIKE parcial', async () => {
      const pool = buildPoolPara([], 0);
      const repository = new AuditoriaRepository(pool);

      await repository.listar({
        usuario: 'op-1',
        operacion: 'baja',
        limit: 20,
        offset: 0,
      });

      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('usuario ILIKE $1 AND operacion ILIKE $2'),
        ['%op-1%', '%baja%', 20, 0],
      );
    });

    it('filtra por rango de fecha (desde/hasta inclusive)', async () => {
      const pool = buildPoolPara([], 0);
      const repository = new AuditoriaRepository(pool);

      await repository.listar({
        fechaDesde: '2026-08-01T00:00:00.000Z',
        fechaHasta: '2026-08-14T23:59:59.000Z',
        limit: 20,
        offset: 0,
      });

      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('fecha >= $1 AND fecha <= $2'),
        ['2026-08-01T00:00:00.000Z', '2026-08-14T23:59:59.000Z', 20, 0],
      );
    });

    it('combina todos los filtros y la paginacion a la vez', async () => {
      const pool = buildPoolPara([], 0);
      const repository = new AuditoriaRepository(pool);

      await repository.listar({
        usuario: 'op-1',
        operacion: 'baja',
        fechaDesde: '2026-08-01T00:00:00.000Z',
        fechaHasta: '2026-08-14T23:59:59.000Z',
        limit: 10,
        offset: 5,
      });

      expect(pool.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        '%op-1%',
        '%baja%',
        '2026-08-01T00:00:00.000Z',
        '2026-08-14T23:59:59.000Z',
        10,
        5,
      ]);
    });
  });
});
