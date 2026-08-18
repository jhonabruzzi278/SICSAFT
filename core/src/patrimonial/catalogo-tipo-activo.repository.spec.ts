import type { Pool } from 'pg';
import { CatalogoTipoActivoRepository } from './catalogo-tipo-activo.repository';
import type { NuevoCatalogoTipoActivoInput } from './catalogo-tipo-activo.types';

const FILA: NuevoCatalogoTipoActivoInput & { id: string } = {
  id: 'catalogo-notebook',
  tipo: 'Equipo Computacional',
  familia: 'Informática',
  subfamilia: 'Notebook',
  marca: 'Dell',
  modelo: 'Latitude 5440',
  fabricante: 'Dell Inc.',
  vidaUtilMeses: 36,
  criticidad: 'alta',
  tecnologiaIdentificacion: 'qr',
};

describe('CatalogoTipoActivoRepository', () => {
  describe('listar', () => {
    it('devuelve el catalogo ordenado por tipo y familia', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [FILA] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new CatalogoTipoActivoRepository(pool);

      await expect(repository.listar()).resolves.toEqual([FILA]);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY tipo, familia'),
      );
    });
  });

  describe('crear', () => {
    const INPUT: NuevoCatalogoTipoActivoInput = {
      tipo: 'Equipo Computacional',
      familia: 'Informática',
      subfamilia: 'Notebook',
      marca: 'Dell',
      modelo: 'Latitude 5440',
      fabricante: 'Dell Inc.',
      vidaUtilMeses: 36,
      criticidad: 'alta',
      tecnologiaIdentificacion: 'qr',
    };

    it('inserta el tipo de catalogo y devuelve el registro creado', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [FILA] }); // SELECT posterior
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new CatalogoTipoActivoRepository(pool);

      const tipo = await repository.crear(INPUT);

      expect(tipo).toEqual(FILA);
      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO catalogo_activos'),
        expect.arrayContaining([
          INPUT.tipo,
          INPUT.familia,
          INPUT.subfamilia,
          INPUT.marca,
          INPUT.modelo,
          INPUT.fabricante,
          INPUT.vidaUtilMeses,
          INPUT.criticidad,
          INPUT.tecnologiaIdentificacion,
        ]),
      );
    });

    it('usa null para los campos opcionales ausentes', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [FILA] });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new CatalogoTipoActivoRepository(pool);

      await repository.crear({
        tipo: 'Mobiliario',
        familia: 'Oficina',
        criticidad: 'baja',
        tecnologiaIdentificacion: 'rfid',
      });

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO catalogo_activos'),
        expect.arrayContaining([null, null, null, null, null]),
      );
    });
  });
});
