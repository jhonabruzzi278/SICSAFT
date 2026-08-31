import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  EstadoResponsable,
  NuevoResponsableInput,
  Responsable,
  ResponsablesPagina,
} from './responsable.types';
import { verificarPerteneceOrganizacion } from './verificar-pertenece';

const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const SELECT_RESPONSABLE_SQL = `
  SELECT id, identificacion, nombre, cargo, area_id AS "areaId", correo, telefono, estado
  FROM responsables
`;

@Injectable()
export class ResponsableRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // RNF-01 (cierra el gap) — paginado real via LIMIT/OFFSET, con COUNT(*) para el total.
  async findByArea(
    areaId: string,
    limit: number,
    offset: number,
  ): Promise<ResponsablesPagina> {
    const totalResult = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM responsables WHERE area_id = $1',
      [areaId],
    );
    const result = await this.pool.query<Responsable>(
      `${SELECT_RESPONSABLE_SQL} WHERE area_id = $1 ORDER BY nombre LIMIT $2 OFFSET $3`,
      [areaId, limit, offset],
    );
    return {
      responsables: result.rows,
      total: Number(totalResult.rows[0]?.total ?? '0'),
    };
  }

  // DOC-029 RF-B — resolver un responsable por nombre dentro de la organización (via su área),
  // para que `aprobar` un lote de importación lo encuentre o lo cree. `responsables` no tiene
  // organizacion_id: se cruza por `areas`. Case-insensitive y sin espacios sobrantes.
  async buscarPorNombre(
    organizacionId: string,
    nombre: string,
  ): Promise<Responsable | null> {
    const result = await this.pool.query<Responsable>(
      `SELECT r.id, r.identificacion, r.nombre, r.cargo, r.area_id AS "areaId",
              r.correo, r.telefono, r.estado
       FROM responsables r
       JOIN areas a ON a.id = r.area_id
       WHERE a.organizacion_id = $1 AND lower(btrim(r.nombre)) = lower(btrim($2))
       LIMIT 1`,
      [organizacionId, nombre],
    );
    return result.rows[0] ?? null;
  }

  // RF-05 — `identificacion` es unica (migracion 1755100000000): reintentar la misma alta dos
  // veces es un 409, no un duplicado silencioso.
  async crear(input: NuevoResponsableInput): Promise<Responsable> {
    await this.verificarAreaPerteneceOrganizacion(
      input.areaId,
      input.organizacionId,
    );

    const id = randomUUID();
    try {
      await this.pool.query(
        `INSERT INTO responsables (id, identificacion, nombre, cargo, area_id, correo, telefono, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')`,
        [
          id,
          input.identificacion,
          input.nombre,
          input.cargo ?? null,
          input.areaId,
          input.correo ?? null,
          input.telefono ?? null,
        ],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException({
          message: `Ya existe un responsable con identificacion '${input.identificacion}'`,
        });
      }
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message: `areaId '${input.areaId}' inexistente`,
        });
      }
      throw error;
    }
    const result = await this.pool.query<Responsable>(
      `${SELECT_RESPONSABLE_SQL} WHERE id = $1`,
      [id],
    );
    // Recien insertado con este mismo id — nunca undefined.
    return result.rows[0];
  }

  // RF-05 — la "baja" de un Responsable es cambiar `estado` a 'inactivo' (nunca un DELETE, Tomo
  // III 4.10). Cruza `area_id -> organizacion_id` contra `organizacionId` (defensa en
  // profundidad, mismo motivo que ActivoRepository.cambiarEstado).
  async actualizarEstado(
    id: string,
    organizacionId: string,
    estado: EstadoResponsable,
  ): Promise<Responsable> {
    const actual = await this.findConOrganizacion(id);
    if (!actual || actual.organizacionId !== organizacionId) {
      throw new NotFoundException({
        message: `No existe el responsable '${id}'`,
      });
    }
    await this.pool.query('UPDATE responsables SET estado = $1 WHERE id = $2', [
      estado,
      id,
    ]);
    return { ...actual.responsable, estado };
  }

  private async findConOrganizacion(
    id: string,
  ): Promise<{ responsable: Responsable; organizacionId: string } | null> {
    const result = await this.pool.query<
      Responsable & { organizacionId: string }
    >(
      `SELECT r.id, r.identificacion, r.nombre, r.cargo, r.area_id AS "areaId", r.correo,
              r.telefono, r.estado, a.organizacion_id AS "organizacionId"
       FROM responsables r JOIN areas a ON a.id = r.area_id WHERE r.id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    const { organizacionId, ...responsable } = row;
    return { responsable, organizacionId };
  }

  private verificarAreaPerteneceOrganizacion(
    areaId: string,
    organizacionId: string,
  ): Promise<void> {
    return verificarPerteneceOrganizacion(
      this.pool,
      `SELECT organizacion_id AS "organizacionId" FROM areas WHERE id = $1`,
      areaId,
      organizacionId,
      'areaId',
    );
  }
}
