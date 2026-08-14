import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  ActualizarUbicacionInput,
  NuevaUbicacionInput,
  Ubicacion,
  UbicacionesPagina,
} from './ubicacion.types';

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

  // RNF-01 (cierra el gap) — paginado real via LIMIT/OFFSET, con COUNT(*) para el total.
  async findBySede(
    sedeId: string,
    limit: number,
    offset: number,
  ): Promise<UbicacionesPagina> {
    const totalResult = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM ubicaciones WHERE sede_id = $1',
      [sedeId],
    );
    const result = await this.pool.query<Ubicacion>(
      `${SELECT_UBICACION_SQL} WHERE sede_id = $1 ORDER BY edificio, piso LIMIT $2 OFFSET $3`,
      [sedeId, limit, offset],
    );
    return {
      ubicaciones: result.rows,
      total: Number(totalResult.rows[0]?.total ?? '0'),
    };
  }

  // RF-05 — defensa en profundidad: `sedeId` (y `areaId`, si viene) deben pertenecer a
  // `organizacionId`, no solo existir — mismo criterio que ActivoRepository cruzando la
  // organizacion real del activo objetivo (hallazgo real de revision de seguridad, DOC-012 §3).
  async crear(input: NuevaUbicacionInput): Promise<Ubicacion> {
    await this.verificarPertenece(
      'sedes',
      input.sedeId,
      input.organizacionId,
      'sedeId',
    );
    if (input.areaId) {
      await this.verificarPertenece(
        'areas',
        input.areaId,
        input.organizacionId,
        'areaId',
      );
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
        throw new BadRequestException({
          message: 'sedeId o areaId inexistente',
        });
      }
      throw error;
    }
    const result = await this.pool.query<Ubicacion>(
      `${SELECT_UBICACION_SQL} WHERE id = $1`,
      [id],
    );
    // Recien insertada con este mismo id — nunca undefined.
    return result.rows[0];
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /ubicaciones/:id. Sin `sedeId` en `cambios`, la
  // ubicacion no cambia de sede (ver ubicacion.types.ts). Cross-org: la ubicacion no tiene
  // organizacionId propio, se deriva de su sede actual — mismo criterio "404 sin confirmar
  // existencia en otra organizacion" que ActivoRepository.cambiarEstado.
  async actualizar(
    id: string,
    organizacionId: string,
    cambios: ActualizarUbicacionInput,
  ): Promise<Ubicacion> {
    const actual = await this.pool.query<Ubicacion>(
      `${SELECT_UBICACION_SQL} WHERE id = $1`,
      [id],
    );
    const ubicacion = actual.rows[0];
    if (!ubicacion) {
      throw new NotFoundException({
        message: `No existe la ubicacion '${id}'`,
      });
    }

    const sedeResult = await this.pool.query<{ organizacionId: string }>(
      `SELECT organizacion_id AS "organizacionId" FROM sedes WHERE id = $1`,
      [ubicacion.sedeId],
    );
    if (sedeResult.rows[0]?.organizacionId !== organizacionId) {
      throw new NotFoundException({
        message: `No existe la ubicacion '${id}'`,
      });
    }

    if (cambios.areaId !== undefined) {
      await this.verificarPertenece(
        'areas',
        cambios.areaId,
        organizacionId,
        'areaId',
      );
    }

    const sets: string[] = [];
    const valores: unknown[] = [];
    if (cambios.edificio !== undefined) {
      valores.push(cambios.edificio);
      sets.push(`edificio = $${valores.length}`);
    }
    if (cambios.piso !== undefined) {
      valores.push(cambios.piso);
      sets.push(`piso = $${valores.length}`);
    }
    if (cambios.areaId !== undefined) {
      valores.push(cambios.areaId);
      sets.push(`area_id = $${valores.length}`);
    }
    if (cambios.oficina !== undefined) {
      valores.push(cambios.oficina);
      sets.push(`oficina = $${valores.length}`);
    }
    if (cambios.dependencia !== undefined) {
      valores.push(cambios.dependencia);
      sets.push(`dependencia = $${valores.length}`);
    }

    if (sets.length === 0) {
      return ubicacion;
    }

    valores.push(id);
    await this.pool.query(
      `UPDATE ubicaciones SET ${sets.join(', ')} WHERE id = $${valores.length}`,
      valores,
    );

    const result = await this.pool.query<Ubicacion>(
      `${SELECT_UBICACION_SQL} WHERE id = $1`,
      [id],
    );
    return result.rows[0];
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
