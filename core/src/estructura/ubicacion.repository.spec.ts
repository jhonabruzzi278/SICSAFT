/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
    it('devuelve las filas de la sede paginadas y el total real (RNF-01, cierra el gap)', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ total: '1' }] })
          .mockResolvedValueOnce({ rows: [UBICACION_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      const pagina = await repository.findBySede('melipilla', 20, 0);

      expect(pagina).toEqual({ ubicaciones: [UBICACION_ROW], total: 1 });
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        'melipilla',
        20,
        0,
      ]);
    });
  });

  // DOC-029 RF-B — el Excel contable ubica los bienes por area y nunca trae ubicacion fisica,
  // pero el catalogo operativo exige ubicacion_id (DOC-006 2). Sin esto los activos importados
  // quedaban en la BPI pero invisibles en catalogo, etiquetas y CIP.
  describe('resolverPorArea', () => {
    it('reusa la ubicacion principal que el area ya tiene, sin crear nada', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [{ ubicacionPrincipalId: 'ubic-ya' }],
        }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(repository.resolverPorArea('org-1', 'area-1')).resolves.toBe(
        'ubic-ya',
      );
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('adopta una ubicacion ya asociada al area y la marca como principal', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ ubicacionPrincipalId: null }] })
          .mockResolvedValueOnce({ rows: [{ id: 'ubic-asociada' }] })
          .mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(repository.resolverPorArea('org-1', 'area-1')).resolves.toBe(
        'ubic-asociada',
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE areas SET ubicacion_principal_id'),
        ['area-1', 'ubic-asociada'],
      );
    });

    it('crea una ubicacion en la sede de la organizacion y la deja como principal', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ ubicacionPrincipalId: null }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ id: 'sede-1' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      const id = await repository.resolverPorArea('org-1', 'area-1');

      expect(id).toEqual(expect.any(String));
      expect(pool.query).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining('INSERT INTO ubicaciones'),
        [id, 'sede-1', 'area-1', expect.stringContaining('ingesta contable')],
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        5,
        expect.stringContaining('UPDATE areas SET ubicacion_principal_id'),
        ['area-1', id],
      );
    });

    it('devuelve null si la organizacion todavia no tiene sede, sin frenar la aprobacion', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ ubicacionPrincipalId: null }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.resolverPorArea('org-sin-sede', 'area-1'),
      ).resolves.toBeNull();
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('devuelve null si el area no existe en la organizacion', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.resolverPorArea('org-1', 'area-fantasma'),
      ).resolves.toBeNull();
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

  describe('actualizar', () => {
    it('actualiza los campos simples cuando la ubicacion pertenece a la organizacion', async () => {
      const actualizada = { ...UBICACION_ROW, edificio: 'Torre A' };
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [UBICACION_ROW] }) // SELECT actual
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] }) // sede
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [actualizada] }), // SELECT final
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      const ubicacion = await repository.actualizar('ubicacion-1', 'duoc-uc', {
        edificio: 'Torre A',
      });

      expect(ubicacion).toEqual(actualizada);
    });

    it('actualiza piso, areaId, oficina y dependencia', async () => {
      const actualizada = {
        ...UBICACION_ROW,
        piso: '2',
        areaId: 'area-1',
        oficina: '201',
        dependencia: 'Biblioteca',
      };
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [UBICACION_ROW] })
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] }) // sede
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] }) // area
          .mockResolvedValueOnce({ rows: [] }) // UPDATE
          .mockResolvedValueOnce({ rows: [actualizada] }), // SELECT final
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      const ubicacion = await repository.actualizar('ubicacion-1', 'duoc-uc', {
        piso: '2',
        areaId: 'area-1',
        oficina: '201',
        dependencia: 'Biblioteca',
      });

      expect(ubicacion).toEqual(actualizada);
    });

    it('lanza NotFoundException si la ubicacion no existe', async () => {
      const pool = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.actualizar('no-existe', 'duoc-uc', { edificio: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si la sede de la ubicacion es de otra organizacion', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [UBICACION_ROW] })
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'otra-org' }] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.actualizar('ubicacion-1', 'duoc-uc', { edificio: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('valida areaId cross-organizacion antes de escribir', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [UBICACION_ROW] })
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] }) // sede
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'otra-org' }] }), // area
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      await expect(
        repository.actualizar('ubicacion-1', 'duoc-uc', {
          areaId: 'area-de-otra-org',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('devuelve la ubicacion sin cambios si `cambios` viene vacio', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [UBICACION_ROW] })
          .mockResolvedValueOnce({ rows: [{ organizacionId: 'duoc-uc' }] }),
      } as unknown as jest.Mocked<Pool>;
      const repository = new UbicacionRepository(pool);

      const ubicacion = await repository.actualizar(
        'ubicacion-1',
        'duoc-uc',
        {},
      );

      expect(ubicacion).toEqual(UBICACION_ROW);
    });
  });
});
