/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Pool } from 'pg';
import { AuditoriaRepository } from './auditoria.repository';

function buildPool(): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  } as unknown as jest.Mocked<Pool>;
}

describe('AuditoriaRepository', () => {
  it('inserta con todos los campos', async () => {
    const pool = buildPool();
    const repository = new AuditoriaRepository(pool);

    await repository.registrar({
      usuario: 'op-1',
      equipo: 'device-1',
      ip: '10.0.0.1',
      operacion: 'POST /inventarios',
      resultado: 'recibido',
      observaciones: 'ok',
      categoria: 'identidad',
      organizacionId: 'org-1',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      expect.any(String),
      'op-1',
      'device-1',
      '10.0.0.1',
      'POST /inventarios',
      'recibido',
      'ok',
      'identidad',
      'org-1',
    ]);
  });

  it('inserta usando null/patrimonial para los campos opcionales ausentes (DOC-024 3, default)', async () => {
    const pool = buildPool();
    const repository = new AuditoriaRepository(pool);

    await repository.registrar({
      usuario: 'op-1',
      operacion: 'POST /inventarios',
      resultado: 'rechazado:409',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      expect.any(String),
      'op-1',
      null,
      null,
      'POST /inventarios',
      'rechazado:409',
      null,
      'patrimonial',
      null,
    ]);
  });

  // DOC-024 3 — un evento de auditoria nunca debe poder tumbar la operacion que esta registrando.
  it('reintenta sin organizacionId cuando el INSERT falla por FK invalida (23503)', async () => {
    const pool = {
      query: jest
        .fn()
        .mockRejectedValueOnce({ code: '23503' })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as jest.Mocked<Pool>;
    const repository = new AuditoriaRepository(pool);

    await repository.registrar({
      usuario: 'op-1',
      operacion: 'DELETE /admin/organizaciones/org-fantasma/usuarios/user-1',
      resultado: 'ok',
      organizacionId: 'org-fantasma',
    });

    expect(pool.query).toHaveBeenCalledTimes(2);
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.arrayContaining([null]),
    );
    const segundaLlamada = pool.query.mock.calls[1] as unknown as [
      string,
      unknown[],
    ];
    expect(segundaLlamada[1].at(-1)).toBeNull();
  });

  it('propaga otros errores del INSERT sin reintentar', async () => {
    const error = new Error('conexion perdida');
    const pool = {
      query: jest.fn().mockRejectedValueOnce(error),
    } as unknown as jest.Mocked<Pool>;
    const repository = new AuditoriaRepository(pool);

    await expect(
      repository.registrar({
        usuario: 'op-1',
        operacion: 'POST /inventarios',
        resultado: 'ok',
      }),
    ).rejects.toThrow(error);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  describe('listar', () => {
    function buildPoolPara(rows: unknown[], total: number): jest.Mocked<Pool> {
      return {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [{ total: String(total) }] }) // COUNT(*)
          .mockResolvedValueOnce({ rows }), // SELECT paginado
      } as unknown as jest.Mocked<Pool>;
    }

    it('devuelve las filas con fecha serializada a ISO y el total real (RNF-01, cierra el gap)', async () => {
      const fecha = new Date('2026-08-14T10:00:00.000Z');
      const pool = buildPoolPara(
        [
          {
            id: 'audit-1',
            usuario: 'op-1',
            fecha,
            equipo: null,
            ip: null,
            operacion: 'POST /inventarios',
            resultado: 'recibido',
            observaciones: null,
            categoria: 'patrimonial',
            organizacionId: null,
          },
        ],
        1,
      );
      const repository = new AuditoriaRepository(pool);

      const pagina = await repository.listar({ limit: 20, offset: 0 });

      expect(pagina.total).toBe(1);
      expect(pagina.entradas).toEqual([
        {
          id: 'audit-1',
          usuario: 'op-1',
          fecha: '2026-08-14T10:00:00.000Z',
          equipo: null,
          ip: null,
          operacion: 'POST /inventarios',
          resultado: 'recibido',
          observaciones: null,
          categoria: 'patrimonial',
          organizacionId: null,
        },
      ]);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [20, 0],
      );
    });

    it('filtra por categoria y organizacionId con igualdad exacta (DOC-024 3)', async () => {
      const pool = buildPoolPara([], 0);
      const repository = new AuditoriaRepository(pool);

      await repository.listar({
        categoria: 'identidad',
        organizacionId: 'org-1',
        limit: 20,
        offset: 0,
      });

      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('categoria = $1 AND organizacion_id = $2'),
        ['identidad', 'org-1', 20, 0],
      );
    });

    it('filtra por usuario y operacion con ILIKE parcial', async () => {
      const pool = buildPoolPara([], 0);
      const repository = new AuditoriaRepository(pool);

      await repository.listar({
        usuario: 'op-1',
        operacion: 'baja',
        limit: 20,
        offset: 0,
      });

      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('usuario ILIKE $1 AND operacion ILIKE $2'),
        ['%op-1%', '%baja%', 20, 0],
      );
    });

    it('filtra por rango de fecha (desde/hasta inclusive)', async () => {
      const pool = buildPoolPara([], 0);
      const repository = new AuditoriaRepository(pool);

      await repository.listar({
        fechaDesde: '2026-08-01T00:00:00.000Z',
        fechaHasta: '2026-08-14T23:59:59.000Z',
        limit: 20,
        offset: 0,
      });

      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('fecha >= $1 AND fecha <= $2'),
        ['2026-08-01T00:00:00.000Z', '2026-08-14T23:59:59.000Z', 20, 0],
      );
    });

    it('combina todos los filtros y la paginacion a la vez', async () => {
      const pool = buildPoolPara([], 0);
      const repository = new AuditoriaRepository(pool);

      await repository.listar({
        usuario: 'op-1',
        operacion: 'baja',
        fechaDesde: '2026-08-01T00:00:00.000Z',
        fechaHasta: '2026-08-14T23:59:59.000Z',
        limit: 10,
        offset: 5,
      });

      expect(pool.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        '%op-1%',
        '%baja%',
        '2026-08-01T00:00:00.000Z',
        '2026-08-14T23:59:59.000Z',
        10,
        5,
      ]);
    });
  });
});
