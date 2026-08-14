/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { AreaRepository } from './area.repository';
import type { Area } from './area.types';

const AREA_ROW: Area = {
  id: 'area-1',
  organizacionId: 'duoc-uc',
  codigo: 'BIB',
  nombre: 'Biblioteca',
  dependencia: null,
  centroCosto: null,
  responsableId: null,
  ubicacionPrincipalId: null,
};

describe('AreaRepository', () => {
  describe('findByOrganizacion', () => {
    it('devuelve las filas de la organizacion', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [AREA_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      await expect(repository.findByOrganizacion('duoc-uc')).resolves.toEqual([
        AREA_ROW,
      ]);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['duoc-uc']);
    });
  });

  describe('crear', () => {
    it('inserta y devuelve el area recien creada', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [AREA_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      const area = await repository.crear({
        organizacionId: 'duoc-uc',
        codigo: 'BIB',
        nombre: 'Biblioteca',
      });

      expect(area).toEqual(AREA_ROW);
    });

    it('traduce una violacion de FK a BadRequestException', async () => {
      const pool = {
        query: jest.fn().mockRejectedValue({ code: '23503' }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      await expect(
        repository.crear({
          organizacionId: 'no-existe',
          codigo: 'BIB',
          nombre: 'Biblioteca',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('relanza un error que no es de Postgres', async () => {
      const pool = {
        query: jest.fn().mockRejectedValue(new Error('boom')),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      await expect(
        repository.crear({ organizacionId: 'duoc-uc', codigo: 'BIB', nombre: 'Biblioteca' }),
      ).rejects.toThrow('boom');
    });
  });
});
