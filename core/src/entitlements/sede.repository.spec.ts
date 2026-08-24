import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { SedeRepository } from './sede.repository';
import type { NuevaSedeInput } from './sede.types';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('SedeRepository', () => {
  describe('listarPorOrganizacion', () => {
    it('devuelve las sedes de la organizacion ordenadas por nombre (DOC-024 1)', async () => {
      const rows = [
        {
          id: 'melipilla',
          organizacionId: 'duoc-uc',
          nombre: 'Melipilla',
          estado: 'activo',
        },
      ];
      const query = jest.fn().mockResolvedValue({ rows });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      await expect(
        repository.listarPorOrganizacion('duoc-uc'),
      ).resolves.toEqual(rows);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organizacion_id = $1'),
        ['duoc-uc'],
      );
    });
  });

  describe('findById', () => {
    it('devuelve la sede cuando existe', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'melipilla',
            organizacionId: 'duoc-uc',
            nombre: 'Melipilla',
            estado: 'activo',
          },
        ],
      });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      await expect(repository.findById('melipilla')).resolves.toEqual({
        id: 'melipilla',
        organizacionId: 'duoc-uc',
        nombre: 'Melipilla',
        estado: 'activo',
      });
    });

    it('devuelve null cuando no existe', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      await expect(repository.findById('no-existe')).resolves.toBeNull();
    });
  });

  describe('crear', () => {
    const INPUT: NuevaSedeInput = {
      organizacionId: 'duoc-uc',
      nombre: 'Melipilla',
    };

    it('inserta la sede con un id generado por CORE y devuelve el registro creado', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      const sede = await repository.crear(INPUT);

      expect(sede.id).toMatch(UUID_REGEX);
      expect(sede.organizacionId).toBe(INPUT.organizacionId);
      expect(sede.nombre).toBe(INPUT.nombre);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sedes'),
        [sede.id, INPUT.organizacionId, INPUT.nombre],
      );
    });

    it('genera un id distinto en cada llamada', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      const primera = await repository.crear(INPUT);
      const segunda = await repository.crear(INPUT);

      expect(primera.id).not.toBe(segunda.id);
    });

    it('lanza 400 si organizacionId no existe (foreign key violation)', async () => {
      const query = jest.fn().mockRejectedValueOnce({ code: '23503' });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('relanza otros errores de Postgres sin envolver', async () => {
      const error = new Error('conexion perdida');
      const query = jest.fn().mockRejectedValueOnce(error);
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toBe(error);
    });
  });

  describe('actualizarEstado', () => {
    it('cambia el estado y devuelve el registro — sin cascada (DOC-024 1)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'melipilla',
              organizacionId: 'duoc-uc',
              nombre: 'Melipilla',
              estado: 'activo',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      const sede = await repository.actualizarEstado(
        'melipilla',
        'duoc-uc',
        'inactivo',
      );

      expect(sede.estado).toBe('inactivo');
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE sedes'),
        ['inactivo', 'melipilla'],
      );
    });

    it('lanza 404 si la sede no existe', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      await expect(
        repository.actualizarEstado('no-existe', 'duoc-uc', 'inactivo'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si la sede existe pero pertenece a otra organizacion', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'melipilla',
            organizacionId: 'otra-org',
            nombre: 'Melipilla',
            estado: 'activo',
          },
        ],
      });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new SedeRepository(pool);

      await expect(
        repository.actualizarEstado('melipilla', 'duoc-uc', 'inactivo'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
