/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Pool, PoolClient } from 'pg';
import {
  ImportacionContableLoteRepository,
  type FilaLoteParaCrear,
} from './importacion-contable-lote.repository';
import type { LoteImportacionContable } from './importacion-contable-lote.types';

const FILA_CREAR: FilaLoteParaCrear = {
  linea: 1,
  codigoPatrimonial: 'DG-001',
  codigoQr: 'DG-001',
  catalogoId: 'cat-1',
  serie: undefined,
  responsableId: 'resp-1',
  areaId: 'area-1',
  ubicacionId: undefined,
  valorPatrimonial: 850000,
  crudo: { CODIGO: 'DG-001', DIRECCION: 'DIRECCION GENERAL' },
  dryRunResultado: 'crear',
  dryRunMotivo: null,
};
const FILA_CONFLICTO: FilaLoteParaCrear = {
  ...FILA_CREAR,
  linea: 2,
  codigoPatrimonial: 'DG-002',
  codigoQr: 'DG-002',
  dryRunResultado: 'conflicto',
  dryRunMotivo: 'Ya existe con datos distintos.',
};

const LOTE_ROW: LoteImportacionContable = {
  id: 'lote-1',
  organizacionId: 'muni',
  origen: 'carpeta',
  archivoNombre: 'activos.xls',
  recibidoEn: '2026-08-31T12:00:00.000Z',
  estado: 'pendiente_revision',
  revisadoPor: null,
  revisadoEn: null,
  motivoRechazo: null,
  resumen: { totalFilas: 2, crear: 1, yaImportado: 0, conflicto: 1 },
};

function mockClient(query = jest.fn().mockResolvedValue({ rows: [] })): {
  client: PoolClient;
  query: jest.Mock;
  release: jest.Mock;
} {
  const release = jest.fn();
  return {
    client: { query, release } as unknown as PoolClient,
    query,
    release,
  };
}

describe('ImportacionContableLoteRepository', () => {
  describe('crear', () => {
    it('inserta el lote y todas sus filas en una transacción y devuelve el resumen', async () => {
      const { client, query, release } = mockClient();
      const pool = {
        connect: jest.fn().mockResolvedValue(client),
      } as unknown as jest.Mocked<Pool>;
      const repo = new ImportacionContableLoteRepository(pool);

      const { loteId, resumen } = await repo.crear({
        organizacionId: 'muni',
        origen: 'carpeta',
        archivoNombre: 'activos.xls',
        filas: [FILA_CREAR, FILA_CONFLICTO],
      });

      expect(typeof loteId).toBe('string');
      expect(resumen).toEqual({
        totalFilas: 2,
        crear: 1,
        yaImportado: 0,
        conflicto: 1,
      });
      expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
      // 1 BEGIN + 1 INSERT lote + 2 INSERT fila + 1 COMMIT
      expect(query).toHaveBeenCalledTimes(5);
      expect(query).toHaveBeenLastCalledWith('COMMIT');
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('hace ROLLBACK y relanza si un INSERT falla', async () => {
      const { client, query, release } = mockClient(
        jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('fk violation')), // INSERT lote
      );
      const pool = {
        connect: jest.fn().mockResolvedValue(client),
      } as unknown as jest.Mocked<Pool>;
      const repo = new ImportacionContableLoteRepository(pool);

      await expect(
        repo.crear({
          organizacionId: 'muni',
          origen: 'manual',
          archivoNombre: null,
          filas: [FILA_CREAR],
        }),
      ).rejects.toThrow('fk violation');

      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe('listar', () => {
    it('sin estado devuelve todos los lotes de la organización', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [LOTE_ROW] }),
      } as unknown as jest.Mocked<Pool>;
      const repo = new ImportacionContableLoteRepository(pool);

      const lotes = await repo.listar('muni');

      expect(lotes).toEqual([LOTE_ROW]);
      expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['muni']);
    });

    it('con estado filtra por estado', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repo = new ImportacionContableLoteRepository(pool);

      await repo.listar('muni', 'pendiente_revision');

      expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('$2'), [
        'muni',
        'pendiente_revision',
      ]);
    });
  });

  describe('obtener', () => {
    it('devuelve null si el lote no existe', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repo = new ImportacionContableLoteRepository(pool);

      expect(await repo.obtener('nope')).toBeNull();
    });

    it('devuelve el lote con sus filas, normalizando valorPatrimonial numérico y nulo', async () => {
      const pool = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [LOTE_ROW] })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'f1',
                linea: 1,
                codigoPatrimonial: 'DG-001',
                codigoQr: 'DG-001',
                catalogoId: 'cat-1',
                serie: null,
                responsableId: 'resp-1',
                areaId: 'area-1',
                ubicacionId: null,
                valorPatrimonial: '850000',
                crudo: { CODIGO: 'DG-001' },
                dryRunResultado: 'crear',
                dryRunMotivo: null,
              },
              {
                id: 'f2',
                linea: 2,
                codigoPatrimonial: 'DG-002',
                codigoQr: 'DG-002',
                catalogoId: 'cat-1',
                serie: null,
                responsableId: null,
                areaId: null,
                ubicacionId: null,
                valorPatrimonial: null,
                crudo: {},
                dryRunResultado: 'conflicto',
                dryRunMotivo: 'x',
              },
            ],
          }),
      } as unknown as jest.Mocked<Pool>;
      const repo = new ImportacionContableLoteRepository(pool);

      const resultado = await repo.obtener('lote-1');

      expect(resultado?.lote).toEqual(LOTE_ROW);
      expect(resultado?.filas[0].valorPatrimonial).toBe(850000);
      expect(resultado?.filas[1].valorPatrimonial).toBeNull();
    });
  });

  describe('marcarRevisado', () => {
    it('actualiza estado, revisor y motivo', async () => {
      const pool = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
      } as unknown as jest.Mocked<Pool>;
      const repo = new ImportacionContableLoteRepository(pool);

      await repo.marcarRevisado('lote-1', 'rechazado', 'op-1', 'no cuadra');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['lote-1', 'rechazado', 'op-1', 'no cuadra'],
      );
    });
  });
});
