import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { EstadoSede, NuevaSedeInput, Sede } from './sede.types';

// Mismo codigo SQLSTATE que contrato.repository.ts/activo.repository.ts.
const FOREIGN_KEY_VIOLATION = '23503';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const SELECT_SEDE_SQL =
  'SELECT id, organizacion_id AS "organizacionId", nombre, estado FROM sedes';

@Injectable()
export class SedeRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // DOC-024 1 — GET /sedes?organizacionId=, mismo picker que usa el formulario de Contrato en vez
  // de que el operador copie/pegue un id a mano.
  async listarPorOrganizacion(organizacionId: string): Promise<Sede[]> {
    const result = await this.pool.query<Sede>(
      `${SELECT_SEDE_SQL} WHERE organizacion_id = $1 ORDER BY nombre`,
      [organizacionId],
    );
    return result.rows;
  }

  // DOC-024 1 — usado por actualizarEstado para resolver 404 y cruzar organizacionId (defensa en
  // profundidad, mismo patron que ContratoRepository.findById).
  async findById(id: string): Promise<Sede | null> {
    const result = await this.pool.query<Sede>(
      `${SELECT_SEDE_SQL} WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  // A diferencia de OrganizacionRepository.crear (donde `id` = org_id real de Zitadel, un sistema
  // externo), acá no hay ningun id externo con el que calzar — CORE genera un UUID, mismo
  // criterio que ActivoRepository/ContratoRepository para sus propios ids. `estado` lo decide
  // CORE ('activo'), nunca el cliente.
  async crear(input: NuevaSedeInput): Promise<Sede> {
    const id = randomUUID();
    try {
      await this.pool.query(
        "INSERT INTO sedes (id, organizacion_id, nombre, estado) VALUES ($1, $2, $3, 'activo')",
        [id, input.organizacionId, input.nombre],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message: `organizacionId '${input.organizacionId}' inexistente`,
        });
      }
      throw error;
    }
    return {
      id,
      organizacionId: input.organizacionId,
      nombre: input.nombre,
      estado: 'activo',
    };
  }

  // DOC-024 1 — PATCH /sedes/:id/estado. Bidireccional, nunca DELETE (Tomo III 4.10). Cruza
  // `organizacionId` contra la organizacion real de la sede (defensa en profundidad, mismo
  // criterio que ContratoRepository.actualizarEstado/ResponsableRepository.actualizarEstado).
  async actualizarEstado(
    id: string,
    organizacionId: string,
    estado: EstadoSede,
  ): Promise<Sede> {
    const actual = await this.findById(id);
    if (!actual || actual.organizacionId !== organizacionId) {
      throw new NotFoundException({ message: `No existe la sede '${id}'` });
    }
    await this.pool.query('UPDATE sedes SET estado = $1 WHERE id = $2', [
      estado,
      id,
    ]);
    return { ...actual, estado };
  }
}
