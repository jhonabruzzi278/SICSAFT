import type { Pool } from 'pg';
import { DashboardRepository } from './dashboard.repository';

function buildPool(
  impl: (sql: string, params?: unknown[]) => { rows: unknown[] },
): jest.Mocked<Pool> {
  return {
    query: jest.fn((sql: string, params?: unknown[]) =>
      Promise.resolve(impl(sql, params)),
    ),
  } as unknown as jest.Mocked<Pool>;
}

describe('DashboardRepository', () => {
  describe('obtenerCobertura', () => {
    it('mapea la fila existente', async () => {
      const pool = buildPool(() => ({
        rows: [
          {
            activos_registrados: 10,
            activos_escaneados: 4,
            porcentaje_cobertura: '0.4',
          },
        ],
      }));
      const repository = new DashboardRepository(pool);

      await expect(repository.obtenerCobertura('org-1')).resolves.toEqual({
        activosRegistrados: 10,
        activosEscaneados: 4,
        porcentajeCobertura: 0.4,
      });
    });

    it('devuelve null si la organizacion no tiene fila todavia', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new DashboardRepository(pool);

      await expect(repository.obtenerCobertura('org-1')).resolves.toBeNull();
    });
  });

  it('listarAreas mapea las filas', async () => {
    const pool = buildPool(() => ({
      rows: [
        {
          area_id: 'area-1',
          controlada_en_periodo: true,
          ultima_sesion_en: '2026-01-01T00:00:00.000Z',
        },
      ],
    }));
    const repository = new DashboardRepository(pool);

    await expect(repository.listarAreas('org-1')).resolves.toEqual([
      {
        areaId: 'area-1',
        controladaEnPeriodo: true,
        ultimaSesionEn: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  describe('listarSesiones', () => {
    it('sin areaId solo filtra por organizacion', async () => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const pool = buildPool((sql, params) => {
        queries.push({ sql, params: params ?? [] });
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ count: '1' }] };
        }
        return {
          rows: [
            {
              sesion_id: 'ses-1',
              area_id: 'area-1',
              veredicto: 'exitoso',
              fecha_cierre: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      });
      const repository = new DashboardRepository(pool);

      const pagina = await repository.listarSesiones('org-1', undefined, 20, 0);

      expect(pagina).toEqual({
        total: 1,
        items: [
          {
            sesionId: 'ses-1',
            areaId: 'area-1',
            veredicto: 'exitoso',
            fechaCierre: '2026-01-01T00:00:00.000Z',
          },
        ],
      });
      expect(queries[1].sql).not.toContain('area_id = $2');
      expect(queries[1].params).toEqual(['org-1', 20, 0]);
    });

    it('con areaId agrega el filtro', async () => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const pool = buildPool((sql, params) => {
        queries.push({ sql, params: params ?? [] });
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ count: '0' }] };
        }
        return { rows: [] };
      });
      const repository = new DashboardRepository(pool);

      await repository.listarSesiones('org-1', 'area-1', 20, 0);

      expect(queries[0].sql).toContain('area_id = $2');
      expect(queries[0].params).toEqual(['org-1', 'area-1']);
    });
  });

  describe('listarFueraDeArea', () => {
    it('filtra por area_esperada_id cuando se pasa areaId', async () => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const pool = buildPool((sql, params) => {
        queries.push({ sql, params: params ?? [] });
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ count: '0' }] };
        }
        return { rows: [] };
      });
      const repository = new DashboardRepository(pool);

      await repository.listarFueraDeArea('org-1', 'area-2', 20, 0);

      expect(queries[0].sql).toContain('area_esperada_id = $2');
    });

    it('mapea filas sin filtro de area', async () => {
      const pool = buildPool((sql) => {
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ count: '1' }] };
        }
        return {
          rows: [
            {
              codigo_qr: 'QR-1',
              area_real_id: 'area-1',
              area_esperada_id: 'area-2',
              detectado_en: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      });
      const repository = new DashboardRepository(pool);

      const pagina = await repository.listarFueraDeArea(
        'org-1',
        undefined,
        20,
        0,
      );

      expect(pagina.items).toEqual([
        {
          codigoQr: 'QR-1',
          areaRealId: 'area-1',
          areaEsperadaId: 'area-2',
          detectadoEn: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });
  });

  it('listarNoLocalizados mapea filas', async () => {
    const pool = buildPool((sql) => {
      if (sql.startsWith('SELECT COUNT')) {
        return { rows: [{ count: '1' }] };
      }
      return {
        rows: [{ codigo_qr: 'QR-1', desde_en: '2026-01-01T00:00:00.000Z' }],
      };
    });
    const repository = new DashboardRepository(pool);

    const pagina = await repository.listarNoLocalizados('org-1', 20, 0);

    expect(pagina).toEqual({
      total: 1,
      items: [{ codigoQr: 'QR-1', desdeEn: '2026-01-01T00:00:00.000Z' }],
    });
  });

  describe('listarIncidencias', () => {
    it('filtra por codigoQr cuando se pasa', async () => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const pool = buildPool((sql, params) => {
        queries.push({ sql, params: params ?? [] });
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ count: '0' }] };
        }
        return { rows: [] };
      });
      const repository = new DashboardRepository(pool);

      await repository.listarIncidencias('org-1', 'QR-1', 20, 0);

      expect(queries[0].sql).toContain('codigo_qr = $2');
    });

    it('mapea filas sin filtro', async () => {
      const pool = buildPool((sql) => {
        if (sql.startsWith('SELECT COUNT')) {
          return { rows: [{ count: '1' }] };
        }
        return {
          rows: [
            {
              sesion_id: 'ses-1',
              codigo_qr: 'QR-1',
              observaciones: 'Pantalla rota',
              fecha: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      });
      const repository = new DashboardRepository(pool);

      const pagina = await repository.listarIncidencias(
        'org-1',
        undefined,
        20,
        0,
      );

      expect(pagina.items).toEqual([
        {
          sesionId: 'ses-1',
          codigoQr: 'QR-1',
          observaciones: 'Pantalla rota',
          fecha: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });
  });

  it('listarEstadoActivos mapea filas', async () => {
    const pool = buildPool(() => ({
      rows: [{ estado: 'activo', cantidad: 5 }],
    }));
    const repository = new DashboardRepository(pool);

    await expect(repository.listarEstadoActivos('org-1')).resolves.toEqual([
      { estado: 'activo', cantidad: 5 },
    ]);
  });

  describe('listarCategorias', () => {
    it('usa "(todas)" cuando no se pasa areaId', async () => {
      const queries: Array<{ sql: string; params: unknown[] }> = [];
      const pool = buildPool((sql, params) => {
        queries.push({ sql, params: params ?? [] });
        return { rows: [] };
      });
      const repository = new DashboardRepository(pool);

      await repository.listarCategorias('org-1', undefined);

      expect(queries[0].params).toEqual(['org-1', '(todas)']);
    });

    it('mapea filas cuando se pasa areaId', async () => {
      const pool = buildPool(() => ({
        rows: [{ area_id: 'area-1', familia: 'Informática', cantidad: 2 }],
      }));
      const repository = new DashboardRepository(pool);

      await expect(
        repository.listarCategorias('org-1', 'area-1'),
      ).resolves.toEqual([
        { areaId: 'area-1', familia: 'Informática', cantidad: 2 },
      ]);
    });
  });

  describe('obtenerSyncInfo', () => {
    it('mapea la fila existente', async () => {
      const pool = buildPool(() => ({
        rows: [
          {
            ultimo_evento_procesado_en: '2026-01-01T00:00:00.000Z',
            al_dia: false,
          },
        ],
      }));
      const repository = new DashboardRepository(pool);

      await expect(repository.obtenerSyncInfo()).resolves.toEqual({
        actualizadoEn: '2026-01-01T00:00:00.000Z',
        alDia: false,
      });
    });

    it('devuelve defaults si la fila singleton no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new DashboardRepository(pool);

      await expect(repository.obtenerSyncInfo()).resolves.toEqual({
        actualizadoEn: null,
        alDia: true,
      });
    });
  });
});
