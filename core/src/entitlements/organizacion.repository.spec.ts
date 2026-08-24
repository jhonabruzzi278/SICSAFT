import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { OrganizacionRepository } from './organizacion.repository';
import type { NuevaOrganizacionInput } from './organizacion.types';

describe('OrganizacionRepository', () => {
  describe('listar', () => {
    it('devuelve las organizaciones ordenadas por nombre', async () => {
      const rows = [
        { id: 'duoc-uc', nombre: 'DUOC UC', estado: 'activo' },
        { id: 'melipilla', nombre: 'Melipilla', estado: 'activo' },
      ];
      const query = jest.fn().mockResolvedValue({ rows });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      await expect(repository.listar()).resolves.toEqual(rows);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY nombre'),
      );
    });
  });

  describe('findById', () => {
    it('devuelve la organizacion cuando existe', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ id: 'duoc-uc', nombre: 'DUOC UC', estado: 'activo' }],
      });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      await expect(repository.findById('duoc-uc')).resolves.toEqual({
        id: 'duoc-uc',
        nombre: 'DUOC UC',
        estado: 'activo',
      });
    });

    it('devuelve null cuando no existe', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      await expect(repository.findById('no-existe')).resolves.toBeNull();
    });
  });

  describe('crear', () => {
    const INPUT: NuevaOrganizacionInput = {
      id: 'duoc-uc',
      nombre: 'DUOC UC',
    };

    it('inserta la organizacion y devuelve el registro creado con estado activo', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      const organizacion = await repository.crear(INPUT);

      expect(organizacion).toEqual({ ...INPUT, estado: 'activo' });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO organizaciones'),
        [INPUT.id, INPUT.nombre],
      );
    });

    it('lanza 409 si ya existe una organizacion con ese id (unique violation)', async () => {
      const query = jest.fn().mockRejectedValueOnce({ code: '23505' });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(ConflictException);
    });

    it('relanza otros errores de Postgres sin envolver', async () => {
      const error = new Error('conexion perdida');
      const query = jest.fn().mockRejectedValueOnce(error);
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toBe(error);
    });
  });

  describe('actualizarNombre', () => {
    it('actualiza el nombre y devuelve el registro (DOC-024 1)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'duoc-uc', nombre: 'DUOC UC', estado: 'activo' }],
        })
        .mockResolvedValueOnce({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      const organizacion = await repository.actualizarNombre(
        'duoc-uc',
        'DUOC UC (renombrada)',
      );

      expect(organizacion).toEqual({
        id: 'duoc-uc',
        nombre: 'DUOC UC (renombrada)',
        estado: 'activo',
      });
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE organizaciones'),
        ['DUOC UC (renombrada)', 'duoc-uc'],
      );
    });

    it('lanza 404 si la organizacion no existe', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      await expect(
        repository.actualizarNombre('no-existe', 'Nombre nuevo'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizarEstado', () => {
    it('cambia el estado y devuelve el registro — sin cascada (DOC-024 1)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ id: 'duoc-uc', nombre: 'DUOC UC', estado: 'activo' }],
        })
        .mockResolvedValueOnce({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      const organizacion = await repository.actualizarEstado(
        'duoc-uc',
        'inactivo',
      );

      expect(organizacion).toEqual({
        id: 'duoc-uc',
        nombre: 'DUOC UC',
        estado: 'inactivo',
      });
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE organizaciones'),
        ['inactivo', 'duoc-uc'],
      );
    });

    it('lanza 404 si la organizacion no existe', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      await expect(
        repository.actualizarEstado('no-existe', 'inactivo'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
