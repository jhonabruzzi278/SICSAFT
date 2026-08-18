import { ConflictException } from '@nestjs/common';
import type { Pool } from 'pg';
import { OrganizacionRepository } from './organizacion.repository';
import type { NuevaOrganizacionInput } from './organizacion.types';

describe('OrganizacionRepository', () => {
  describe('listar', () => {
    it('devuelve las organizaciones ordenadas por nombre', async () => {
      const rows = [
        { id: 'duoc-uc', nombre: 'DUOC UC' },
        { id: 'melipilla', nombre: 'Melipilla' },
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

  describe('crear', () => {
    const INPUT: NuevaOrganizacionInput = {
      id: 'duoc-uc',
      nombre: 'DUOC UC',
    };

    it('inserta la organizacion y devuelve el registro creado', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new OrganizacionRepository(pool);

      const organizacion = await repository.crear(INPUT);

      expect(organizacion).toEqual(INPUT);
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
});
