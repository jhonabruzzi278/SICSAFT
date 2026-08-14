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
    it('devuelve las filas con fecha serializada a ISO, con el limite', async () => {
      const fecha = new Date('2026-08-14T10:00:00.000Z');
      const pool = {
        query: jest.fn().mockResolvedValue({
          rows: [
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
        }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AuditoriaRepository(pool);

      const resultado = await repository.listar();

      expect(resultado).toEqual([
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
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [200]);
    });
  });
});
