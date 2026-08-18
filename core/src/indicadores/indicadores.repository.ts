import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { ContratosPorEstado, Indicadores } from './indicadores.types';

@Injectable()
export class IndicadoresRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async obtener(): Promise<Indicadores> {
    const [organizaciones, sedes, contratosPorEstado] = await Promise.all([
      this.contar('organizaciones'),
      this.contar('sedes'),
      this.contarContratosPorEstado(),
    ]);
    return {
      totalOrganizaciones: organizaciones,
      totalSedes: sedes,
      contratosPorEstado,
    };
  }

  private async contar(tabla: 'organizaciones' | 'sedes'): Promise<number> {
    const result = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM ${tabla}`,
    );
    return Number(result.rows[0]?.total ?? '0');
  }

  private async contarContratosPorEstado(): Promise<ContratosPorEstado> {
    const result = await this.pool.query<{ estado: string; total: string }>(
      'SELECT estado, COUNT(*) AS total FROM contratos GROUP BY estado',
    );
    const conteos = new Map(
      result.rows.map((row) => [row.estado, Number(row.total)]),
    );
    return {
      vigente: conteos.get('vigente') ?? 0,
      suspendido: conteos.get('suspendido') ?? 0,
      vencido: conteos.get('vencido') ?? 0,
      cancelado: conteos.get('cancelado') ?? 0,
    };
  }
}
