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
});
