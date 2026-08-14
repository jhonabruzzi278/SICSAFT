import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { NuevaUbicacionInput, Ubicacion } from './ubicacion.types';

const FOREIGN_KEY_VIOLATION = '23503';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const SELECT_UBICACION_SQL = `
  SELECT id, sede_id AS "sedeId", edificio, piso, area_id AS "areaId", oficina, dependencia
  FROM ubicaciones
`;

@Injectable()
export class UbicacionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findBySede(sedeId: string): Promise<Ubicacion[]> {
    const result = await this.pool.query<Ubicacion>(
      `${SELECT_UBICACION_SQL} WHERE sede_id = $1 ORDER BY edificio, piso`,
      [sedeId],
    );
    return result.rows;
  }

  // RF-05 — defensa en profundidad: `sedeId` (y `areaId`, si viene) deben pertenecer a
  // `organizacionId`, no solo existir — mismo criterio que ActivoRepository cruzando la
  // organizacion real del activo objetivo (hallazgo real de revision de seguridad, DOC-012 §3).
  async crear(input: NuevaUbicacionInput): Promise<Ubicacion> {
    await this.verificarPertenece('sedes', input.sedeId, input.organizacionId, 'sedeId');
    if (input.areaId) {
      await this.verificarPertenece('areas', input.areaId, input.organizacionId, 'areaId');
    }

    const id = randomUUID();
    try {
      await this.pool.query(
        `INSERT INTO ubicaciones (id, sede_id, edificio, piso, area_id, oficina, dependencia)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          input.sedeId,
          input.edificio ?? null,
          input.piso ?? null,
          input.areaId ?? null,
          input.oficina ?? null,
          input.dependencia ?? null,
        ],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({ message: 'sedeId o areaId inexistente' });
      }
      throw error;
    }
    const result = await this.pool.query<Ubicacion>(
      `${SELECT_UBICACION_SQL} WHERE id = $1`,
      [id],
    );
    // Recien insertada con este mismo id — nunca undefined.
    return result.rows[0] as Ubicacion;
  }

  private async verificarPertenece(
    tabla: 'sedes' | 'areas',
    id: string,
    organizacionId: string,
    campo: string,
  ): Promise<void> {
    const result = await this.pool.query<{ organizacionId: string }>(
      `SELECT organizacion_id AS "organizacionId" FROM ${tabla} WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row || row.organizacionId !== organizacionId) {
      throw new BadRequestException({
        message: `${campo} '${id}' inexistente en la organizacion '${organizacionId}'`,
      });
    }
  }
}
