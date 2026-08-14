/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { ContratoRepository } from './contrato.repository';
import type { NuevoContratoInput } from './contrato.types';

function buildPool(rows: unknown[]): jest.Mocked<Pool> {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as jest.Mocked<Pool>;
}

const CONTRATO_ROW = {
  id: 'contrato-1',
  organizacionId: 'duoc-uc',
  organizacionNombre: 'DUOC UC',
  vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
  vigenciaHasta: null,
  estado: 'vigente' as const,
  modulosContratados: ['inventario-qr'] as const,
  sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
};

describe('ContratoRepository', () => {
  it('mapea filas de postgres a Contrato[], incluyendo fechas ISO y sedes anidadas', async () => {
    const pool = buildPool([
      {
        id: 'contrato-duoc-uc-melipilla',
        organizacionId: 'duoc-uc',
        organizacionNombre: 'DUOC UC',
        vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
        vigenciaHasta: null,
        estado: 'vigente',
        modulosContratados: ['inventario-qr'],
        sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      },
    ]);
    const repository = new ContratoRepository(pool);

    const contratos = await repository.findAll();

    expect(contratos).toEqual([
      {
        id: 'contrato-duoc-uc-melipilla',
        organizacionId: 'duoc-uc',
        organizacionNombre: 'DUOC UC',
        sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
        vigenciaDesde: '2026-01-01T00:00:00.000Z',
        vigenciaHasta: null,
        estado: 'vigente',
        modulosContratados: ['inventario-qr'],
      },
    ]);
  });

  it('mapea vigenciaHasta no nula a ISO string', async () => {
    const pool = buildPool([
      {
        id: 'contrato-x',
        organizacionId: 'org-x',
        organizacionNombre: 'Org X',
        vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
        vigenciaHasta: new Date('2026-12-31T00:00:00.000Z'),
        estado: 'vencido',
        modulosContratados: [],
        sedes: [],
      },
    ]);
    const repository = new ContratoRepository(pool);

    const [contrato] = await repository.findAll();

    expect(contrato.vigenciaHasta).toBe('2026-12-31T00:00:00.000Z');
  });

  it('lanza si los datos leidos violan el invariante DOC-004 §4 (sede con mas de un contrato vigente)', async () => {
    const filaBase = {
      organizacionId: 'org-x',
      organizacionNombre: 'Org X',
      vigenciaDesde: new Date('2026-01-01T00:00:00.000Z'),
      vigenciaHasta: null,
      estado: 'vigente' as const,
      modulosContratados: ['inventario-qr'] as const,
      sedes: [{ id: 'sede-1', nombre: 'Sede 1' }],
    };
    const pool = buildPool([
      { ...filaBase, id: 'contrato-1' },
      { ...filaBase, id: 'contrato-2' },
    ]);
    const repository = new ContratoRepository(pool);

    await expect(repository.findAll()).rejects.toThrow(/sede-1/);
  });

  describe('findById', () => {
    it('devuelve el contrato cuando existe', async () => {
      const pool = buildPool([CONTRATO_ROW]);
      const repository = new ContratoRepository(pool);

      const contrato = await repository.findById('contrato-1');

      expect(contrato?.id).toBe('contrato-1');
    });

    it('devuelve null cuando no existe', async () => {
      const pool = buildPool([]);
      const repository = new ContratoRepository(pool);

      await expect(repository.findById('no-existe')).resolves.toBeNull();
    });
  });

  describe('crear', () => {
    const INPUT: NuevoContratoInput = {
      organizacionId: 'duoc-uc',
      sedeIds: ['melipilla'],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      modulosContratados: ['inventario-qr'],
    };

    // La transaccion (BEGIN/INSERT contratos/INSERT contrato_sedes/COMMIT|ROLLBACK) corre sobre
    // un client dedicado (pool.connect()), no sobre pool.query directo — mismo motivo que evito
    // el hallazgo real de un contrato huerfano sin sedes cuando contrato_sedes fallaba a mitad
    // de camino (ver comentario en contrato.repository.ts).
    function buildClient(
      queryImpl: (sql: string) => { rows: unknown[] } | Promise<never>,
    ) {
      const query = jest.fn((sql: string) => {
        const resultado = queryImpl(sql);
        return resultado instanceof Promise
          ? resultado
          : Promise.resolve(resultado);
      });
      const release = jest.fn();
      return { query, release };
    }

    it('inserta el contrato y sus sedes en una transaccion, y devuelve el registro creado', async () => {
      const client = buildClient(() => ({ rows: [] }));
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // SELECT sedes en conflicto
          .mockResolvedValueOnce({ rows: [CONTRATO_ROW] }), // findById posterior (fuera de la transaccion)
        connect: jest.fn().mockResolvedValue(client),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ContratoRepository(pool);

      const contrato = await repository.crear(INPUT);

      expect(contrato.id).toBe('contrato-1');
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO contratos'),
        expect.arrayContaining([INPUT.organizacionId, INPUT.vigenciaDesde]),
      );
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalled();
    });

    it('lanza 409 (DOC-004 §4) si alguna sede ya esta cubierta por un contrato vigente', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [{ sedeId: 'melipilla' }] }),
        connect: jest.fn(),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ContratoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(ConflictException);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    it('hace ROLLBACK y lanza 400 si organizacionId o alguna sedeId no existe (foreign key violation) — sin dejar el contrato huerfano', async () => {
      const client = buildClient((sql) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        if (sql.startsWith('INSERT INTO contratos')) {
          return { rows: [] };
        }
        // INSERT INTO contrato_sedes falla por FK.
        return Promise.reject(
          Object.assign(new Error('foreign key violation'), {
            code: '23503',
          }),
        );
      });
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }), // SELECT sedes en conflicto
        connect: jest.fn().mockResolvedValue(client),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ContratoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(
        BadRequestException,
      );
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });

    it('hace ROLLBACK y lanza 409 si ya existe un contrato con ese id (unique violation)', async () => {
      const client = buildClient((sql) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        return Promise.reject(
          Object.assign(new Error('unique violation'), { code: '23505' }),
        );
      });
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }), // SELECT sedes en conflicto
        connect: jest.fn().mockResolvedValue(client),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ContratoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(ConflictException);
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('relanza otros errores de Postgres sin envolver, despues del ROLLBACK', async () => {
      const errorInesperado = new Error('conexion perdida');
      const client = buildClient((sql) => {
        if (sql === 'BEGIN' || sql === 'ROLLBACK') {
          return { rows: [] };
        }
        return Promise.reject(errorInesperado);
      });
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }), // SELECT sedes en conflicto
        connect: jest.fn().mockResolvedValue(client),
      } as unknown as jest.Mocked<Pool>;
      const repository = new ContratoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toBe(errorInesperado);
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('actualizarEstado', () => {
    it('actualiza el estado cuando la transicion es valida (vigente -> suspendido)', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [CONTRATO_ROW] }) // findById
        .mockResolvedValueOnce({ rows: [] }); // UPDATE
      const pool = { query } as unknown as jest.Mocked<Pool>;
      const repository = new ContratoRepository(pool);

      const contrato = await repository.actualizarEstado(
        'contrato-1',
        'duoc-uc',
        'suspendido',
      );

      expect(contrato.estado).toBe('suspendido');
    });

    it('lanza 404 si el contrato no existe', async () => {
      const pool = buildPool([]);
      const repository = new ContratoRepository(pool);

      await expect(
        repository.actualizarEstado('no-existe', 'duoc-uc', 'suspendido'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si el contrato existe pero pertenece a otra organizacion', async () => {
      const pool = buildPool([{ ...CONTRATO_ROW, organizacionId: 'otra-org' }]);
      const repository = new ContratoRepository(pool);

      await expect(
        repository.actualizarEstado('contrato-1', 'duoc-uc', 'suspendido'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 400 si la transicion no es valida (ej. vencido -> vigente)', async () => {
      const pool = buildPool([{ ...CONTRATO_ROW, estado: 'vencido' }]);
      const repository = new ContratoRepository(pool);

      await expect(
        repository.actualizarEstado('contrato-1', 'duoc-uc', 'vigente'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
