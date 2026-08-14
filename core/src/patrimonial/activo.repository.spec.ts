import type { Pool } from 'pg';
import { ActivoRepository, construirNombreActivo } from './activo.repository';

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
  organizacionId: 'duoc-uc',
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-biblioteca-101',
  estado: 'activo' as const,
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
        organizacionId: 'duoc-uc',
        areaId: 'area-biblioteca',
        ubicacionId: 'ubicacion-biblioteca-101',
        estado: 'activo',
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
            codigoQr: 'QR-000001',
            nombre: 'Dell Latitude 5440',
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
});
