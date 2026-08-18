/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { DocumentoActivoRepository } from './documento-activo.repository';
import type { NuevoDocumentoActivoInput } from './documento-activo.types';

const DOCUMENTO = {
  id: 'documento-1',
  activoId: 'activo-1',
  organizacionId: 'duoc-uc',
  tipo: 'documento' as const,
  url: 'https://example.com/doc.pdf',
  descripcion: 'Factura de compra',
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'op-admin',
};

function buildPool(
  queryImpl: (
    sql: string,
    params?: unknown[],
  ) => { rows?: unknown[]; rowCount?: number },
): jest.Mocked<Pool> {
  return {
    query: jest.fn((sql: string, params?: unknown[]) =>
      Promise.resolve(queryImpl(sql, params)),
    ),
  } as unknown as jest.Mocked<Pool>;
}

describe('DocumentoActivoRepository', () => {
  describe('listarPorActivo', () => {
    it('devuelve los documentos del activo cuando la organizacion coincide', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('FROM activos')) {
          return { rows: [{ organizacionId: 'duoc-uc' }] };
        }
        return { rows: [DOCUMENTO] };
      });
      const repository = new DocumentoActivoRepository(pool);

      await expect(
        repository.listarPorActivo('activo-1', 'duoc-uc'),
      ).resolves.toEqual([DOCUMENTO]);
    });

    it('lanza 404 si el activo no existe', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new DocumentoActivoRepository(pool);

      await expect(
        repository.listarPorActivo('no-existe', 'duoc-uc'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si el activo pertenece a otra organizacion', async () => {
      const pool = buildPool(() => ({
        rows: [{ organizacionId: 'otra-org' }],
      }));
      const repository = new DocumentoActivoRepository(pool);

      await expect(
        repository.listarPorActivo('activo-1', 'duoc-uc'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('crear', () => {
    const INPUT: NuevoDocumentoActivoInput = {
      activoId: 'activo-1',
      organizacionId: 'duoc-uc',
      tipo: 'documento',
      url: 'https://example.com/doc.pdf',
      descripcion: 'Factura de compra',
      creadoPor: 'op-admin',
    };

    it('inserta el documento y devuelve el registro creado', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('FROM activos')) {
          return { rows: [{ organizacionId: 'duoc-uc' }] };
        }
        if (sql.startsWith('INSERT')) {
          return { rows: [] };
        }
        return { rows: [DOCUMENTO] };
      });
      const repository = new DocumentoActivoRepository(pool);

      await expect(repository.crear(INPUT)).resolves.toEqual(DOCUMENTO);
    });

    it('lanza 404 si el activo no existe o pertenece a otra organizacion', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('FROM activos')) {
          return { rows: [{ organizacionId: 'otra-org' }] };
        }
        return { rows: [] };
      });
      const repository = new DocumentoActivoRepository(pool);

      await expect(repository.crear(INPUT)).rejects.toThrow(NotFoundException);
    });

    it('usa null cuando descripcion no viene', async () => {
      const query = jest.fn();
      const pool = buildPool((sql) => {
        query(sql);
        if (sql.includes('FROM activos')) {
          return { rows: [{ organizacionId: 'duoc-uc' }] };
        }
        if (sql.startsWith('INSERT')) {
          return { rows: [] };
        }
        return { rows: [DOCUMENTO] };
      });
      const repository = new DocumentoActivoRepository(pool);

      await repository.crear({
        activoId: 'activo-1',
        organizacionId: 'duoc-uc',
        tipo: 'fotografia',
        url: 'https://example.com/foto.png',
        creadoPor: 'op-admin',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO documentos_activo'),
        expect.arrayContaining([null]),
      );
    });
  });

  describe('eliminar', () => {
    it('elimina el documento cuando existe', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('FROM activos')) {
          return { rows: [{ organizacionId: 'duoc-uc' }] };
        }
        return { rowCount: 1 };
      });
      const repository = new DocumentoActivoRepository(pool);

      await expect(
        repository.eliminar('documento-1', 'activo-1', 'duoc-uc'),
      ).resolves.toBeUndefined();
    });

    it('lanza 404 si el activo no existe o pertenece a otra organizacion', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('FROM activos')) {
          return { rows: [] };
        }
        return { rowCount: 0 };
      });
      const repository = new DocumentoActivoRepository(pool);

      await expect(
        repository.eliminar('documento-1', 'activo-1', 'duoc-uc'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 404 si el documento no existe para ese activo (rowCount 0)', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('FROM activos')) {
          return { rows: [{ organizacionId: 'duoc-uc' }] };
        }
        return { rowCount: 0 };
      });
      const repository = new DocumentoActivoRepository(pool);

      await expect(
        repository.eliminar('no-existe', 'activo-1', 'duoc-uc'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
