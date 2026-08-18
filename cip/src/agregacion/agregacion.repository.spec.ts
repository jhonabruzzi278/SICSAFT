/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Pool } from 'pg';
import { AgregacionRepository } from './agregacion.repository';

function buildPool(
  impl?: (sql: string, params?: unknown[]) => { rows: unknown[] },
): jest.Mocked<Pool> {
  return {
    query: jest.fn((sql: string, params?: unknown[]) =>
      Promise.resolve(impl ? impl(sql, params) : { rows: [] }),
    ),
  } as unknown as jest.Mocked<Pool>;
}

describe('AgregacionRepository', () => {
  it('upsertVeredictoSesion inserta con los 5 campos esperados', async () => {
    const pool = buildPool();
    const repository = new AgregacionRepository(pool);

    await repository.upsertVeredictoSesion({
      sesionId: 'ses-1',
      organizacionId: 'org-1',
      areaId: 'area-1',
      veredicto: 'exitoso',
      fechaCierre: '2026-01-01T00:00:00.000Z',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      'ses-1',
      'org-1',
      'area-1',
      'exitoso',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  it('upsertControlArea marca controlada_en_periodo true', async () => {
    const pool = buildPool();
    const repository = new AgregacionRepository(pool);

    await repository.upsertControlArea(
      'area-1',
      'org-1',
      '2026-01-01T00:00:00.000Z',
    );

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      'area-1',
      'org-1',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  describe('marcarEscaneadosAlgunaVez', () => {
    it('no llama a la base si no hay codigos', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.marcarEscaneadosAlgunaVez('org-1', []);

      expect(pool.query).not.toHaveBeenCalled();
    });

    it('inserta un codigo por organizacion', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.marcarEscaneadosAlgunaVez('org-1', ['QR-1', 'QR-2']);

      expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
        ['QR-1', 'QR-2'],
        ['org-1', 'org-1'],
      ]);
    });
  });

  describe('recalcularCobertura', () => {
    it('calcula el porcentaje contra activos_registrados dado', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('SELECT COUNT')) {
          return { rows: [{ count: '3' }] };
        }
        return { rows: [] };
      });
      const repository = new AgregacionRepository(pool);

      await repository.recalcularCobertura('org-1', 10);

      expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), [
        'org-1',
        10,
        3,
        0.3,
      ]);
    });

    it('porcentaje 0 cuando no hay activos registrados', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('SELECT COUNT')) {
          return { rows: [{ count: '0' }] };
        }
        return { rows: [] };
      });
      const repository = new AgregacionRepository(pool);

      await repository.recalcularCobertura('org-1', 0);

      expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), [
        'org-1',
        0,
        0,
        0,
      ]);
    });
  });

  it('upsertFueraDeArea inserta con area real y esperada', async () => {
    const pool = buildPool();
    const repository = new AgregacionRepository(pool);

    await repository.upsertFueraDeArea({
      codigoQr: 'QR-1',
      organizacionId: 'org-1',
      areaRealId: 'area-real',
      areaEsperadaId: 'area-esperada',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      'QR-1',
      'org-1',
      'area-real',
      'area-esperada',
    ]);
  });

  it('upsertIncidencia inserta por sesion+codigoQr', async () => {
    const pool = buildPool();
    const repository = new AgregacionRepository(pool);

    await repository.upsertIncidencia({
      sesionId: 'ses-1',
      codigoQr: 'QR-1',
      organizacionId: 'org-1',
      observaciones: 'Pantalla rota',
      fecha: '2026-01-01T00:00:00.000Z',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      'ses-1',
      'QR-1',
      'org-1',
      'Pantalla rota',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  describe('reemplazarEstadoActivoResumen', () => {
    it('borra y reinserta cuando hay filas', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.reemplazarEstadoActivoResumen('org-1', [
        { estado: 'activo', cantidad: 5 },
      ]);

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(1, expect.any(String), [
        'org-1',
      ]);
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        'org-1',
        ['activo'],
        [5],
      ]);
    });

    it('solo borra cuando no hay filas', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.reemplazarEstadoActivoResumen('org-1', []);

      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('reemplazarCategoriaActivoResumen', () => {
    it('borra y reinserta cuando hay filas', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.reemplazarCategoriaActivoResumen('org-1', [
        { areaId: 'area-1', familia: 'Informática', cantidad: 2 },
      ]);

      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('solo borra cuando no hay filas', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.reemplazarCategoriaActivoResumen('org-1', []);

      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('reemplazarActivoNoLocalizado', () => {
    it('borra los que ya no están extraviados e inserta los nuevos sin pisar desde_en existente', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.reemplazarActivoNoLocalizado('org-1', ['QR-1']);

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(1, expect.any(String), [
        'org-1',
        ['QR-1'],
      ]);
    });

    it('solo borra cuando no hay extraviados', async () => {
      const pool = buildPool();
      const repository = new AgregacionRepository(pool);

      await repository.reemplazarActivoNoLocalizado('org-1', []);

      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  it('actualizarSyncEstado marca al_dia true', async () => {
    const pool = buildPool();
    const repository = new AgregacionRepository(pool);

    await repository.actualizarSyncEstado();

    expect(pool.query).toHaveBeenCalledWith(expect.any(String));
  });

  describe('obtenerSyncEstado', () => {
    it('mapea la fila existente', async () => {
      const pool = buildPool(() => ({
        rows: [
          {
            ultimo_evento_procesado_en: '2026-01-01T00:00:00.000Z',
            al_dia: true,
          },
        ],
      }));
      const repository = new AgregacionRepository(pool);

      await expect(repository.obtenerSyncEstado()).resolves.toEqual({
        ultimoEventoProcesadoEn: '2026-01-01T00:00:00.000Z',
        alDia: true,
      });
    });

    it('devuelve defaults si la fila singleton no existe todavía', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new AgregacionRepository(pool);

      await expect(repository.obtenerSyncEstado()).resolves.toEqual({
        ultimoEventoProcesadoEn: null,
        alDia: true,
      });
    });
  });

  it('marcarAtrasado pone al_dia en false', async () => {
    const pool = buildPool();
    const repository = new AgregacionRepository(pool);

    await repository.marcarAtrasado();

    expect(pool.query).toHaveBeenCalledWith(expect.any(String));
  });
});
