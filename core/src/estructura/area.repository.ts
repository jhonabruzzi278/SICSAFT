import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { ActualizarAreaInput, Area, NuevaAreaInput } from './area.types';

const FOREIGN_KEY_VIOLATION = '23503';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const SELECT_AREA_SQL = `
  SELECT id, organizacion_id AS "organizacionId", codigo, nombre, dependencia,
         centro_costo AS "centroCosto", responsable_id AS "responsableId",
         ubicacion_principal_id AS "ubicacionPrincipalId"
  FROM areas
`;

@Injectable()
export class AreaRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByOrganizacion(organizacionId: string): Promise<Area[]> {
    const result = await this.pool.query<Area>(
      `${SELECT_AREA_SQL} WHERE organizacion_id = $1 ORDER BY nombre`,
      [organizacionId],
    );
    return result.rows;
  }

  async crear(input: NuevaAreaInput): Promise<Area> {
    const id = randomUUID();
    try {
      await this.pool.query(
        `INSERT INTO areas (id, organizacion_id, codigo, nombre, dependencia, centro_costo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          input.organizacionId,
          input.codigo,
          input.nombre,
          input.dependencia ?? null,
          input.centroCosto ?? null,
        ],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message: `organizacionId '${input.organizacionId}' inexistente`,
        });
      }
      throw error;
    }
    const result = await this.pool.query<Area>(
      `${SELECT_AREA_SQL} WHERE id = $1`,
      [id],
    );
    // Recien insertada con este mismo id — nunca undefined.
    return result.rows[0] as Area;
  }

  // RF-05 (cierra el gap "ABM completo") — PATCH /areas/:id. Mismo criterio que
  // ActivoRepository.cambiarEstado: si el area no existe o es de otra organizacion, 404 (no 403
  // ni 400) — no confirma si el id existe en otra organizacion, defensa en profundidad. Si
  // responsableId/ubicacionPrincipalId vienen, se validan cross-organizacion antes de escribir
  // (mismo motivo que UbicacionRepository.crear).
  async actualizar(
    id: string,
    organizacionId: string,
    cambios: ActualizarAreaInput,
  ): Promise<Area> {
    const actual = await this.pool.query<Area>(
      `${SELECT_AREA_SQL} WHERE id = $1`,
      [id],
    );
    const area = actual.rows[0];
    if (!area || area.organizacionId !== organizacionId) {
      throw new NotFoundException({ message: `No existe el area '${id}'` });
    }

    if (cambios.responsableId !== undefined) {
      await this.verificarResponsablePerteneceOrganizacion(
        cambios.responsableId,
        organizacionId,
      );
    }
    if (cambios.ubicacionPrincipalId !== undefined) {
      await this.verificarUbicacionPerteneceOrganizacion(
        cambios.ubicacionPrincipalId,
        organizacionId,
      );
    }

    const sets: string[] = [];
    const valores: unknown[] = [];
    if (cambios.codigo !== undefined) {
      valores.push(cambios.codigo);
      sets.push(`codigo = $${valores.length}`);
    }
    if (cambios.nombre !== undefined) {
      valores.push(cambios.nombre);
      sets.push(`nombre = $${valores.length}`);
    }
    if (cambios.dependencia !== undefined) {
      valores.push(cambios.dependencia);
      sets.push(`dependencia = $${valores.length}`);
    }
    if (cambios.centroCosto !== undefined) {
      valores.push(cambios.centroCosto);
      sets.push(`centro_costo = $${valores.length}`);
    }
    if (cambios.responsableId !== undefined) {
      valores.push(cambios.responsableId);
      sets.push(`responsable_id = $${valores.length}`);
    }
    if (cambios.ubicacionPrincipalId !== undefined) {
      valores.push(cambios.ubicacionPrincipalId);
      sets.push(`ubicacion_principal_id = $${valores.length}`);
    }

    if (sets.length === 0) {
      return area;
    }

    valores.push(id);
    await this.pool.query(
      `UPDATE areas SET ${sets.join(', ')} WHERE id = $${valores.length}`,
      valores,
    );

    const result = await this.pool.query<Area>(
      `${SELECT_AREA_SQL} WHERE id = $1`,
      [id],
    );
    return result.rows[0] as Area;
  }

  private async verificarResponsablePerteneceOrganizacion(
    responsableId: string,
    organizacionId: string,
  ): Promise<void> {
    const result = await this.pool.query<{ organizacionId: string }>(
      `SELECT a.organizacion_id AS "organizacionId"
       FROM responsables r JOIN areas a ON a.id = r.area_id
       WHERE r.id = $1`,
      [responsableId],
    );
    const row = result.rows[0];
    if (!row || row.organizacionId !== organizacionId) {
      throw new BadRequestException({
        message: `responsableId '${responsableId}' inexistente en la organizacion '${organizacionId}'`,
      });
    }
  }

  private async verificarUbicacionPerteneceOrganizacion(
    ubicacionId: string,
    organizacionId: string,
  ): Promise<void> {
    const result = await this.pool.query<{ organizacionId: string }>(
      `SELECT s.organizacion_id AS "organizacionId"
       FROM ubicaciones u JOIN sedes s ON s.id = u.sede_id
       WHERE u.id = $1`,
      [ubicacionId],
    );
    const row = result.rows[0];
    if (!row || row.organizacionId !== organizacionId) {
      throw new BadRequestException({
        message: `ubicacionPrincipalId '${ubicacionId}' inexistente en la organizacion '${organizacionId}'`,
      });
    }
  }
}
