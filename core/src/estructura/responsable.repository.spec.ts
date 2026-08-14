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
    it('devuelve las filas del area', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [RESPONSABLE_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ResponsableRepository(pool);

      await expect(repository.findByArea('area-1')).resolves.toEqual([
        RESPONSABLE_ROW,
      ]);
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
