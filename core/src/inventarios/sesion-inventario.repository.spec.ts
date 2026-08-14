/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import type { Pool, PoolClient } from 'pg';
import { SesionInventarioRepository } from './sesion-inventario.repository';
import type {
  CrearSesionInput,
  FilaInventarioInput,
} from './sesion-inventario.repository';

function buildClient(): jest.Mocked<PoolClient> {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  } as unknown as jest.Mocked<PoolClient>;
}

function buildPool(client: jest.Mocked<PoolClient>): jest.Mocked<Pool> {
  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(client),
  } as unknown as jest.Mocked<Pool>;
}

const SESION: CrearSesionInput = {
  id: 'sesion-1',
  idempotencyKey: 'idem-1',
  organizacionId: 'duoc-uc',
  areaId: 'area-biblioteca',
  ubicacionId: 'ubicacion-biblioteca-101',
  operadorId: 'op-1',
  correlationId: 'corr-1',
  fechaInicio: '2026-01-15T10:00:00.000Z',
  fechaCierre: '2026-01-15T10:30:00.000Z',
  estado: 'recibido',
  requestHash: 'hash-1',
};

const FILAS: FilaInventarioInput[] = [
  {
    id: 'inv-1',
    codigoQr: 'QR-000001',
    activoId: 'activo-notebook-001',
    resultado: 'correcto',
  },
  {
    id: 'inv-2',
    codigoQr: 'QR-NOPE',
    activoId: null,
    resultado: 'no_registrado',
  },
];

describe('SesionInventarioRepository', () => {
  describe('findByIdempotencyKey', () => {
    it('devuelve la sesion existente', async () => {
      const client = buildClient();
      const pool = buildPool(client);
      pool.query.mockResolvedValue({
        rows: [{ id: 'sesion-1', estado: 'recibido', requestHash: 'hash-1' }],
      } as never);
      const repository = new SesionInventarioRepository(pool);

      await expect(repository.findByIdempotencyKey('idem-1')).resolves.toEqual({
        id: 'sesion-1',
        estado: 'recibido',
        requestHash: 'hash-1',
      });
    });

    it('devuelve null si no existe', async () => {
      const client = buildClient();
      const pool = buildPool(client);
      pool.query.mockResolvedValue({ rows: [] } as never);
      const repository = new SesionInventarioRepository(pool);

      await expect(
        repository.findByIdempotencyKey('idem-x'),
      ).resolves.toBeNull();
    });
  });

  describe('findEstado', () => {
    it('devuelve estado y ultimoIntento en ISO', async () => {
      const client = buildClient();
      const pool = buildPool(client);
      pool.query.mockResolvedValue({
        rows: [
          {
            estado: 'recibido',
            ultimoIntento: new Date('2026-01-15T10:30:00.000Z'),
          },
        ],
      } as never);
      const repository = new SesionInventarioRepository(pool);

      await expect(repository.findEstado('sesion-1')).resolves.toEqual({
        estado: 'recibido',
        ultimoIntento: '2026-01-15T10:30:00.000Z',
      });
    });

    it('devuelve null si no existe', async () => {
      const client = buildClient();
      const pool = buildPool(client);
      pool.query.mockResolvedValue({ rows: [] } as never);
      const repository = new SesionInventarioRepository(pool);

      await expect(repository.findEstado('sesion-x')).resolves.toBeNull();
    });
  });

  describe('crear', () => {
    it('inserta la sesion y cada fila dentro de una transaccion', async () => {
      const client = buildClient();
      const pool = buildPool(client);
      const repository = new SesionInventarioRepository(pool);

      await repository.crear(SESION, FILAS);

      const llamadas = client.query.mock.calls.map((call) => call[0]);
      expect(llamadas[0]).toBe('BEGIN');
      expect(llamadas[1]).toContain('INSERT INTO sesiones_inventario');
      expect(llamadas[2]).toContain('INSERT INTO inventarios');
      expect(llamadas[3]).toContain('INSERT INTO inventarios');
      expect(llamadas[4]).toBe('COMMIT');
      expect(client.release).toHaveBeenCalledTimes(1);
    });

    it('hace ROLLBACK y relanza si una insercion falla', async () => {
      const client = buildClient();
      (client.query as jest.Mock).mockImplementation((sql: unknown) => {
        if (
          typeof sql === 'string' &&
          sql.startsWith('INSERT INTO sesiones_inventario')
        ) {
          return Promise.reject(new Error('boom'));
        }
        return Promise.resolve({ rows: [] });
      });
      const pool = buildPool(client);
      const repository = new SesionInventarioRepository(pool);

      await expect(repository.crear(SESION, FILAS)).rejects.toThrow('boom');
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  });
});
