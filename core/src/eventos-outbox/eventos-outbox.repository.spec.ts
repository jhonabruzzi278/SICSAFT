/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Pool } from 'pg';
import { EventosOutboxRepository } from './eventos-outbox.repository';

function buildPool(rows: unknown[] = []): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as jest.Mocked<Pool>;
}

describe('EventosOutboxRepository', () => {
  describe('findPendientes', () => {
    it('mapea las filas a camelCase', async () => {
      const pool = buildPool([
        {
          id: 'ob-1',
          evento_id: 'ev-1',
          tipo: 'alta',
          sesion_id: null,
          organizacion_id: 'org-1',
        },
        {
          id: 'ob-2',
          evento_id: 'ev-2',
          tipo: 'escaneo_qr',
          sesion_id: 'ses-1',
          organizacion_id: 'org-1',
        },
      ]);
      const repository = new EventosOutboxRepository(pool);

      const pendientes = await repository.findPendientes(200);

      expect(pendientes).toEqual([
        {
          id: 'ob-1',
          eventoId: 'ev-1',
          tipo: 'alta',
          sesionId: null,
          organizacionId: 'org-1',
        },
        {
          id: 'ob-2',
          eventoId: 'ev-2',
          tipo: 'escaneo_qr',
          sesionId: 'ses-1',
          organizacionId: 'org-1',
        },
      ]);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [200]);
    });

    it('mapea organizacion_id null cuando el evento no resolvió ningún activo', async () => {
      const pool = buildPool([
        {
          id: 'ob-1',
          evento_id: 'ev-1',
          tipo: 'alta',
          sesion_id: null,
          organizacion_id: null,
        },
      ]);
      const repository = new EventosOutboxRepository(pool);

      const pendientes = await repository.findPendientes(200);

      expect(pendientes[0].organizacionId).toBeNull();
    });

    it('devuelve vacío si no hay pendientes', async () => {
      const pool = buildPool([]);
      const repository = new EventosOutboxRepository(pool);

      expect(await repository.findPendientes(200)).toEqual([]);
    });
  });

  describe('marcarPublicados', () => {
    it('actualiza publicado y publicado_en con los ids dados', async () => {
      const pool = buildPool();
      const repository = new EventosOutboxRepository(pool);

      await repository.marcarPublicados(['ob-1', 'ob-2']);

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        ['ob-1', 'ob-2'],
      ]);
    });

    it('no llama a la base si no hay ids', async () => {
      const pool = buildPool();
      const repository = new EventosOutboxRepository(pool);

      await repository.marcarPublicados([]);

      expect(pool.query).not.toHaveBeenCalled();
    });
  });
});
