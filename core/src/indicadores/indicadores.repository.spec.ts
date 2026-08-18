import type { Pool } from 'pg';
import { IndicadoresRepository } from './indicadores.repository';

function buildPool(
  queryImpl: (sql: string) => { rows: unknown[] },
): jest.Mocked<Pool> {
  return {
    query: jest.fn((sql: string) => Promise.resolve(queryImpl(sql))),
  } as unknown as jest.Mocked<Pool>;
}

describe('IndicadoresRepository', () => {
  describe('obtener', () => {
    it('agrega conteos de organizaciones, sedes y contratos por estado', async () => {
      const pool = buildPool((sql) => {
        if (sql.includes('FROM organizaciones')) {
          return { rows: [{ total: '3' }] };
        }
        if (sql.includes('FROM sedes')) {
          return { rows: [{ total: '5' }] };
        }
        if (sql.includes('GROUP BY estado')) {
          return {
            rows: [
              { estado: 'vigente', total: '2' },
              { estado: 'suspendido', total: '1' },
            ],
          };
        }
        return { rows: [] };
      });
      const repository = new IndicadoresRepository(pool);

      const indicadores = await repository.obtener();

      expect(indicadores).toEqual({
        totalOrganizaciones: 3,
        totalSedes: 5,
        contratosPorEstado: {
          vigente: 2,
          suspendido: 1,
          vencido: 0,
          cancelado: 0,
        },
      });
    });

    it('devuelve 0 en todos los conteos cuando las filas vienen vacias', async () => {
      const pool = buildPool(() => ({ rows: [] }));
      const repository = new IndicadoresRepository(pool);

      const indicadores = await repository.obtener();

      expect(indicadores).toEqual({
        totalOrganizaciones: 0,
        totalSedes: 0,
        contratosPorEstado: {
          vigente: 0,
          suspendido: 0,
          vencido: 0,
          cancelado: 0,
        },
      });
    });
  });
});
