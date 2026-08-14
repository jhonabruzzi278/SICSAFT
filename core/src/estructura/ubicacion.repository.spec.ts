/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { UbicacionRepository } from './ubicacion.repository';
import type { Ubicacion } from './ubicacion.types';

const UBICACION_ROW: Ubicacion = {
  id: 'ubicacion-1',
  sedeId: 'melipilla',
  edificio: null,
  piso: null,
  areaId: null,
  oficina: null,
  dependencia: null,
};

describe('UbicacionRepository', () => {
  describe('findBySede', () => {
    it('devuelve las filas de la sede', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [UBICACION_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(repository.findBySede('melipilla')).resolves.toEqual([
        UBICACION_ROW,
      ]);
    });
  });

  describe('crear', () => {
    it('inserta y devuelve la ubicacion recien creada cuando la sede pertenece a la organizacion', async () => {
      const pool = {
        query: jest
          .fn()
          // verificarPertenece('sedes', ...)
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          // INSERT
          .mockResolvedValueOnce({ rows: [] })
          // SELECT final
          .mockResolvedValueOnce({ rows: [UBICACION_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      const ubicacion = await repository.crear({
        organizacionId: 'duoc-uc',
        sedeId: 'melipilla',
      });

      expect(ubicacion).toEqual(UBICACION_ROW);
    });

    it('rechaza con BadRequestException si la sede no pertenece a la organizacion', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'otra-org' }] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.crear({ organizacionId: 'duoc-uc', sedeId: 'melipilla' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con BadRequestException si la sede no existe', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.crear({ organizacionId: 'duoc-uc', sedeId: 'no-existe' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('tambien valida areaId cuando viene informado', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'otra-org' }] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.crear({
          organizacionId: 'duoc-uc',
          sedeId: 'melipilla',
          areaId: 'area-otra-org',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('traduce una violacion de FK del INSERT a BadRequestException', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          .mockRejectedValueOnce({ code: '23503' }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.crear({ organizacionId: 'duoc-uc', sedeId: 'melipilla' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('relanza un error que no es de Postgres en el INSERT', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          .mockRejectedValueOnce(new Error('boom')),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.crear({ organizacionId: 'duoc-uc', sedeId: 'melipilla' }),
      ).rejects.toThrow('boom');
    });
  });
});
