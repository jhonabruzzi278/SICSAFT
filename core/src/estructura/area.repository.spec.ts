/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    it('devuelve las filas de la organizacion paginadas y el total real (RNF-01, cierra el gap)', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ total: '1' }] }) // COUNT(*)
          .mockResolvedValueOnce({ rows: [AREA_ROW] }), // SELECT paginado
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      const pagina = await repository.findByOrganizacion('duoc-uc', 20, 0);

      expect(pagina).toEqual({ areas: [AREA_ROW], total: 1 });
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        'duoc-uc',
        20,
        0,
      ]);
    });
  });

  describe('buscarPorNombre (DOC-029 RF-B)', () => {
    it('devuelve el área que matchea por nombre en la organización', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [AREA_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      const area = await repository.buscarPorNombre('duoc-uc', ' Oficina 1 ');

      expect(area).toEqual(AREA_ROW);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        'duoc-uc',
        ' Oficina 1 ',
      ]);
    });

    it('devuelve null si no hay match', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      expect(await repository.buscarPorNombre('duoc-uc', 'nada')).toBeNull();
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
        repository.crear({
          organizacionId: 'duoc-uc',
          codigo: 'BIB',
          nombre: 'Biblioteca',
        }),
      ).rejects.toThrow('boom');
    });
  });

  describe('actualizar', () => {
    it('actualiza los campos simples y devuelve el area actualizada', async () => {
      const actualizada = { ...AREA_ROW, nombre: 'Biblioteca Central' };
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [AREA_ROW] }) // SELECT actual
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [actualizada] }), // SELECT final
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      const area = await repository.actualizar('area-1', 'duoc-uc', {
        nombre: 'Biblioteca Central',
      });

      expect(area).toEqual(actualizada);
    });

    it('actualiza codigo, dependencia y centroCosto', async () => {
      const actualizada = {
        ...AREA_ROW,
        codigo: 'BIB-2',
        dependencia: 'Rectoria',
        centroCosto: 'CC-100',
      };
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [AREA_ROW] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [actualizada] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      const area = await repository.actualizar('area-1', 'duoc-uc', {
        codigo: 'BIB-2',
        dependencia: 'Rectoria',
        centroCosto: 'CC-100',
      });

      expect(area).toEqual(actualizada);
    });

    it('lanza NotFoundException si el area no existe', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      await expect(
        repository.actualizar('no-existe', 'duoc-uc', { nombre: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el area es de otra organizacion', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [{ ...AREA_ROW, organizacionId: 'otra-org' }],
        }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      await expect(
        repository.actualizar('area-1', 'duoc-uc', { nombre: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('devuelve el area sin cambios si `cambios` viene vacio', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [AREA_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      const area = await repository.actualizar('area-1', 'duoc-uc', {});

      expect(area).toEqual(AREA_ROW);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('valida responsableId cross-organizacion antes de escribir', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [AREA_ROW] }) // SELECT actual
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'otra-org' }] }), // verificarResponsable
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      await expect(
        repository.actualizar('area-1', 'duoc-uc', {
          responsableId: 'responsable-de-otra-org',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('valida ubicacionPrincipalId cross-organizacion antes de escribir', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [AREA_ROW] }) // SELECT actual
          .mockResolvedValueOnce({ rows: [] }), // verificarUbicacion: no existe
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      await expect(
        repository.actualizar('area-1', 'duoc-uc', {
          ubicacionPrincipalId: 'no-existe',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('asigna responsableId y ubicacionPrincipalId cuando ambos son validos', async () => {
      const actualizada = {
        ...AREA_ROW,
        responsableId: 'responsable-1',
        ubicacionPrincipalId: 'ubicacion-1',
      };
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [AREA_ROW] }) // SELECT actual
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] }) // verificarResponsable
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] }) // verificarUbicacion
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [actualizada] }), // SELECT final
      } as unknown as jest.Mocked<Pool>;
      const repository = new AreaRepository(pool);

      const area = await repository.actualizar('area-1', 'duoc-uc', {
        responsableId: 'responsable-1',
        ubicacionPrincipalId: 'ubicacion-1',
      });

      expect(area).toEqual(actualizada);
    });
  });
});
