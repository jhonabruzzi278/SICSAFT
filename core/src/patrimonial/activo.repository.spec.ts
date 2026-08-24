import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { ActivoRepository, construirNombreActivo } from './activo.repository';
import type { NuevoActivoInput } from './activo.types';

function buildPool(
  queryImpl: (sql: string, params?: unknown[]) => { rows: unknown[] },
): jest.Mocked<Pool> {
  return {
    query: jest.fn((sql: string, params?: unknown[]) =>
      Promise.resolve(queryImpl(sql, params)),
    ),
  } as unknown as jest.Mocked<Pool>;
}

const FILA_BASE = {
  id: 'activo-notebook-001',
  codigoPatrimonial: 'AFT-2026-000001',
  codigoQr: 'QR-000001',
  serie: 'SN-2024-001',
  organizacionId: 'duoc-uc',
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-biblioteca-101',
  responsableId: 'resp-1',
  estado: 'activo' as const,
  ultimoInventario: '2026-08-15',
  tipo: 'Equipo Computacional',
  familia: 'Informática',
  subfamilia: 'Notebook',
  marca: 'Dell',
  modelo: 'Latitude 5440',
};

describe('construirNombreActivo', () => {
  it('prioriza marca + modelo cuando ambos existen', () => {
    expect(construirNombreActivo(FILA_BASE)).toBe('Dell Latitude 5440');
  });

  it('usa subfamilia cuando falta marca o modelo', () => {
    expect(
      construirNombreActivo({ ...FILA_BASE, marca: null, modelo: null }),
    ).toBe('Notebook');
  });

  it('cae a "tipo — familia" cuando no hay marca/modelo/subfamilia', () => {
    expect(
      construirNombreActivo({
        ...FILA_BASE,
        marca: null,
        modelo: null,
        subfamilia: null,
      }),
    ).toBe('Equipo Computacional — Informática');
  });
});

describe('ActivoRepository', () => {
  describe('findByCodigoQr', () => {
    it('devuelve el activo mapeado cuando existe', async () => {
      const pool = buildPool(() => ({ rows: [FILA_BASE] }));
      const repository = new ActivoRepository(pool);

      const activo = await repository.findByCodigoQr('QR-000001', 'duoc-uc');

      expect(activo).toEqual({
        id: 'activo-notebook-001',
        codigoPatrimonial: 'AFT-2026-000001',
        codigoQr: 'QR-000001',
        serie: 'SN-2024-001',
        organizacionId: 'duoc-uc',
        areaId: 'area-biblioteca',
        ubicacionId: 'ubicacion-biblioteca-101',
        responsableId: 'resp-1',
        estado: 'activo',
        ultimoInventario: '2026-08-15',
        catalogo: {
          tipo: 'Equipo Computacional',
          familia: 'Informática',
          subfamilia: 'Notebook',
          marca: 'Dell',
          modelo: 'Latitude 5440',
        },
      });
    });

    it('devuelve null cuando no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new ActivoRepository(pool);

      const activo = await repository.findByCodigoQr('QR-NOPE', 'duoc-uc');

      expect(activo).toBeNull();
    });
  });

  describe('existeMasDeUnActivoConCodigoQr', () => {
    it('devuelve true si hay mas de un activo con el mismo codigoQr', async () => {
      const pool = buildPool(() => ({ rows: [{ total: '2' }] }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.existeMasDeUnActivoConCodigoQr('QR-000001'),
      ).resolves.toBe(true);
    });

    it('devuelve false si hay 0 o 1', async () => {
      const pool = buildPool(() => ({ rows: [{ total: '1' }] }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.existeMasDeUnActivoConCodigoQr('QR-000001'),
      ).resolves.toBe(false);
    });

    it('devuelve false cuando la fila total viene vacia', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.existeMasDeUnActivoConCodigoQr('QR-000001'),
      ).resolves.toBe(false);
    });
  });

  describe('findCatalogo', () => {
    it('filtra por organizacion, area y ubicacion, y pagina', async () => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const pool = buildPool((sql, params) => {
        queries.push({ sql, params: params ?? [] });
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ total: '1' }] };
        }
        return { rows: [FILA_BASE] };
      });
      const repository = new ActivoRepository(pool);

      const pagina = await repository.findCatalogo({
        organizacionId: 'duoc-uc',
        areaId: 'area-biblioteca',
        ubicacionId: 'ubicacion-biblioteca-101',
        limit: 20,
        offset: 0,
      });

      expect(pagina).toEqual({
        total: 1,
        activos: [
          {
            id: 'activo-notebook-001',
            codigoQr: 'QR-000001',
            nombre: 'Dell Latitude 5440',
            familia: 'Informática',
            organizacionId: 'duoc-uc',
            areaId: 'area-biblioteca',
            ubicacionId: 'ubicacion-biblioteca-101',
            estado: 'activo',
          },
        ],
      });
      expect(queries[1].sql).toContain('a.area_id = $2');
      expect(queries[1].sql).toContain('a.ubicacion_id = $3');
      expect(queries[1].params).toEqual([
        'duoc-uc',
        'area-biblioteca',
        'ubicacion-biblioteca-101',
        20,
        0,
      ]);
    });

    it('sin areaId/ubicacionId solo filtra por organizacion', async () => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const pool = buildPool((sql, params) => {
        queries.push({ sql, params: params ?? [] });
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ total: '0' }] };
        }
        return { rows: [] };
      });
      const repository = new ActivoRepository(pool);

      const pagina = await repository.findCatalogo({
        organizacionId: 'duoc-uc',
        limit: 20,
        offset: 0,
      });

      expect(pagina).toEqual({ total: 0, activos: [] });
      expect(queries[0].sql).not.toContain('a.area_id =');
      expect(queries[0].sql).not.toContain('a.ubicacion_id =');
    });

    it('devuelve total 0 cuando la fila de conteo viene vacia', async () => {
      const pool = buildPool((sql) => {
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [] };
        }
        return { rows: [] };
      });
      const repository = new ActivoRepository(pool);

      const pagina = await repository.findCatalogo({
        organizacionId: 'duoc-uc',
        limit: 20,
        offset: 0,
      });

      expect(pagina.total).toBe(0);
    });
  });

  describe('findByCodigoPatrimonial', () => {
    it('devuelve el activo mapeado cuando existe', async () => {
      const pool = buildPool(() => ({ rows: [FILA_BASE] }));
      const repository = new ActivoRepository(pool);

      const activo =
        await repository.findByCodigoPatrimonial('AFT-2026-000001');

      expect(activo?.codigoPatrimonial).toBe('AFT-2026-000001');
    });

    it('devuelve null cuando no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.findByCodigoPatrimonial('AFT-NOPE'),
      ).resolves.toBeNull();
    });
  });

  describe('findById', () => {
    it('devuelve el activo cuando existe', async () => {
      const pool = buildPool(() => ({ rows: [FILA_BASE] }));
      const repository = new ActivoRepository(pool);

      const activo = await repository.findById('activo-notebook-001');

      expect(activo?.id).toBe('activo-notebook-001');
    });

    it('devuelve null cuando no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new ActivoRepository(pool);

      await expect(repository.findById('no-existe')).resolves.toBeNull();
    });
  });

  describe('crear', () => {
    const INPUT: NuevoActivoInput = {
      codigoPatrimonial: 'AFT-2026-000099',
      codigoQr: 'QR-000099',
      organizacionId: 'duoc-uc',
      catalogoId: 'catalogo-notebook',
    };

    it('inserta el activo y devuelve el registro creado (DOC-012 5)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [FILA_BASE] }); // findById posterior
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      const activo = await repository.crear(INPUT);

      expect(activo.id).toBe('activo-notebook-001');
      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO activos'),
        expect.arrayContaining([
          INPUT.codigoPatrimonial,
          INPUT.codigoQr,
          INPUT.organizacionId,
          INPUT.catalogoId,
        ]),
      );
    });

    it('lanza 409 si codigoPatrimonial o codigoQr ya existe (unique violation)', async () => {
      const query = jest.fn().mockRejectedValueOnce({ code: '23505' });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(ConflictException);
    });

    it('lanza 400 si organizacionId/catalogoId/responsableId/areaId/ubicacionId no existe (foreign key violation)', async () => {
      const query = jest.fn().mockRejectedValueOnce({ code: '23503' });
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('relanza otros errores de Postgres sin envolver', async () => {
      const error = new Error('conexion perdida');
      const query = jest.fn().mockRejectedValueOnce(error);
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toBe(error);
    });
  });

  describe('cambiarEstado', () => {
    it('actualiza el estado cuando el activo esta en un estado de origen permitido', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({
          rows: [{ ...FILA_BASE, estado: 'extraviado' }],
        }) // findById
        .mockResolvedValueOnce({ rows: [] }); // UPDATE
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      const activo = await repository.cambiarEstado(
        'activo-notebook-001',
        'duoc-uc',
        ['extraviado'],
        'activo',
      );

      expect(activo.estado).toBe('activo');
    });

    it('lanza 404 si el activo no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.cambiarEstado(
          'no-existe',
          'duoc-uc',
          ['extraviado'],
          'activo',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 400 si el activo no esta en un estado de origen permitido (ej. baja de un activo ya dado_de_baja)', async () => {
      const pool = buildPool(() => ({
        rows: [{ ...FILA_BASE, estado: 'dado_de_baja' }],
      }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.cambiarEstado(
          'activo-notebook-001',
          'duoc-uc',
          ['activo', 'extraviado'],
          'dado_de_baja',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // Hallazgo de revision de seguridad: sin este chequeo, un administrador-patrimonial con rol
    // valido en la Organizacion A podia dar de baja/reincorporar un activo real de la
    // Organizacion B con solo conocer su id — el rol se verifica antes (OrquestadorService), pero
    // el repository vuelve a cruzar la organizacion como defensa en profundidad.
    it('lanza 404 si el activo existe pero pertenece a otra organizacion', async () => {
      const pool = buildPool(() => ({
        rows: [{ ...FILA_BASE, organizacionId: 'otra-org' }],
      }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.cambiarEstado(
          'activo-notebook-001',
          'duoc-uc',
          ['activo', 'extraviado'],
          'dado_de_baja',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('actualizarResponsable', () => {
    it('actualiza responsable_id y devuelve el activo', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [FILA_BASE] }) // findById
        .mockResolvedValueOnce({ rows: [] }); // UPDATE
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      const activo = await repository.actualizarResponsable(
        'activo-notebook-001',
        'duoc-uc',
        'resp-2',
      );

      expect(activo.responsableId).toBe('resp-2');
    });

    it('lanza 404 si el activo no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.actualizarResponsable('no-existe', 'duoc-uc', 'resp-2'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si el activo existe pero pertenece a otra organizacion', async () => {
      const pool = buildPool(() => ({
        rows: [{ ...FILA_BASE, organizacionId: 'otra-org' }],
      }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.actualizarResponsable(
          'activo-notebook-001',
          'duoc-uc',
          'resp-2',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 400 si responsableId no existe (foreign key violation)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [FILA_BASE] }) // findById
        .mockRejectedValueOnce({ code: '23503' }); // UPDATE falla
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      await expect(
        repository.actualizarResponsable(
          'activo-notebook-001',
          'duoc-uc',
          'no-existe',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('relanza otros errores de Postgres sin envolver', async () => {
      const error = new Error('conexion perdida');
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [FILA_BASE] }) // findById
        .mockRejectedValueOnce(error); // UPDATE falla
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      await expect(
        repository.actualizarResponsable(
          'activo-notebook-001',
          'duoc-uc',
          'resp-2',
        ),
      ).rejects.toBe(error);
    });
  });

  describe('actualizarDescripcion', () => {
    it('actualiza la descripcion y devuelve el activo', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [FILA_BASE] }) // findById
        .mockResolvedValueOnce({ rows: [] }); // UPDATE
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      const activo = await repository.actualizarDescripcion(
        'activo-notebook-001',
        'duoc-uc',
        'Notebook nuevo',
      );

      expect(activo.descripcion).toBe('Notebook nuevo');
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE activos SET descripcion'),
        ['Notebook nuevo', 'activo-notebook-001'],
      );
    });

    it('acepta null para limpiar la descripcion', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [FILA_BASE] }) // findById
        .mockResolvedValueOnce({ rows: [] }); // UPDATE
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ActivoRepository(pool);

      const activo = await repository.actualizarDescripcion(
        'activo-notebook-001',
        'duoc-uc',
        null,
      );

      expect(activo.descripcion).toBeNull();
    });

    it('lanza 404 si el activo no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.actualizarDescripcion('no-existe', 'duoc-uc', 'texto'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si el activo existe pero pertenece a otra organizacion', async () => {
      const pool = buildPool(() => ({
        rows: [{ ...FILA_BASE, organizacionId: 'otra-org' }],
      }));
      const repository = new ActivoRepository(pool);

      await expect(
        repository.actualizarDescripcion(
          'activo-notebook-001',
          'duoc-uc',
          'texto',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
