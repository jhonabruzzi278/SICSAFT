/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { ResponsableRepository } from './responsable.repository';
import type { Responsable } from './responsable.types';

const RESPONSABLE_ROW: Responsable = {
  id: 'responsable-1',
  identificacion: '11.111.111-1',
  nombre: 'Ana Soto',
  cargo: null,
  areaId: 'area-1',
  correo: null,
  telefono: null,
  estado: 'activo',
};

describe('ResponsableRepository', () => {
  describe('findByArea', () => {
    it('devuelve las filas del area paginadas y el total real (RNF-01, cierra el gap)', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ total: '1' }] })
          .mockResolvedValueOnce({ rows: [RESPONSABLE_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      const pagina = await repository.findByArea('area-1', 20, 0);

      expect(pagina).toEqual({ responsables: [RESPONSABLE_ROW], total: 1 });
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        'area-1',
        20,
        0,
      ]);
    });
  });

  describe('buscarPorNombre (DOC-029 RF-B)', () => {
    it('cruza responsables por su área para matchear en la organización', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [RESPONSABLE_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      const responsable = await repository.buscarPorNombre(
        'duoc-uc',
        'Ana Soto',
      );

      expect(responsable).toEqual(RESPONSABLE_ROW);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN areas'),
        ['duoc-uc', 'Ana Soto'],
      );
    });

    it('devuelve null si no hay match', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      expect(await repository.buscarPorNombre('duoc-uc', 'nadie')).toBeNull();
    });
  });

  describe('crear', () => {
    it('inserta y devuelve el responsable recien creado cuando el area pertenece a la organizacion', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [RESPONSABLE_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      const responsable = await repository.crear({
        organizacionId: 'duoc-uc',
        identificacion: '11.111.111-1',
        nombre: 'Ana Soto',
        areaId: 'area-1',
      });

      expect(responsable).toEqual(RESPONSABLE_ROW);
    });

    it('rechaza con BadRequestException si el area no pertenece a la organizacion', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'otra-org' }] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      await expect(
        repository.crear({
          organizacionId: 'duoc-uc',
          identificacion: '11.111.111-1',
          nombre: 'Ana Soto',
          areaId: 'area-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('traduce una violacion unique de identificacion a ConflictException', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          .mockRejectedValueOnce({ code: '23505' }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      await expect(
        repository.crear({
          organizacionId: 'duoc-uc',
          identificacion: '11.111.111-1',
          nombre: 'Ana Soto',
          areaId: 'area-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('traduce una violacion de FK a BadRequestException', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          .mockRejectedValueOnce({ code: '23503' }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      await expect(
        repository.crear({
          organizacionId: 'duoc-uc',
          identificacion: '11.111.111-1',
          nombre: 'Ana Soto',
          areaId: 'area-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('relanza un error que no es de Postgres', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] })
          .mockRejectedValueOnce(new Error('boom')),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      await expect(
        repository.crear({
          organizacionId: 'duoc-uc',
          identificacion: '11.111.111-1',
          nombre: 'Ana Soto',
          areaId: 'area-1',
        }),
      ).rejects.toThrow('boom');
    });
  });

  describe('actualizarEstado', () => {
    it('actualiza el estado cuando el responsable pertenece a la organizacion', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({
            rows: [{ ...RESPONSABLE_ROW, organizacionId: 'duoc-uc' }],
          })
          .mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      const responsable = await repository.actualizarEstado(
        'responsable-1',
        'duoc-uc',
        'inactivo',
      );

      expect(responsable).toEqual({ ...RESPONSABLE_ROW, estado: 'inactivo' });
    });

    it('lanza NotFoundException si el responsable no existe', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      await expect(
        repository.actualizarEstado('no-existe', 'duoc-uc', 'inactivo'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el responsable es de otra organizacion', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [{ ...RESPONSABLE_ROW, organizacionId: 'otra-org' }],
        }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      await expect(
        repository.actualizarEstado('responsable-1', 'duoc-uc', 'inactivo'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
