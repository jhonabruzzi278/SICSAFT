import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  EstadoOrganizacion,
  NuevaOrganizacionInput,
  Organizacion,
} from './organizacion.types';

const UNIQUE_VIOLATION = '23505';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const SELECT_ORGANIZACION_SQL = 'SELECT id, nombre, estado FROM organizaciones';

@Injectable()
export class OrganizacionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listar(): Promise<Organizacion[]> {
    const result = await this.pool.query<Organizacion>(
      `${SELECT_ORGANIZACION_SQL} ORDER BY nombre`,
    );
    return result.rows;
  }

  // DOC-024 1 — usado por actualizarNombre/actualizarEstado para resolver 404 antes de decidir el
  // UPDATE, mismo patron que ContratoRepository.findById.
  async findById(id: string): Promise<Organizacion | null> {
    const result = await this.pool.query<Organizacion>(
      `${SELECT_ORGANIZACION_SQL} WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  // `id` lo decide el cliente (= org_id real de Zitadel, DOC-021 § organizacion.schemas.ts) — a
  // diferencia de Activo/Contrato/CatalogoTipo, donde CORE siempre genera el id. `estado` lo
  // decide CORE ('activo'), nunca el cliente — mismo criterio que NuevoActivoInput.
  async crear(input: NuevaOrganizacionInput): Promise<Organizacion> {
    try {
      await this.pool.query(
        "INSERT INTO organizaciones (id, nombre, estado) VALUES ($1, $2, 'activo')",
        [input.id, input.nombre],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException({
          message: `Ya existe una organizacion con id '${input.id}'`,
        });
      }
      throw error;
    }
    return { id: input.id, nombre: input.nombre, estado: 'activo' };
  }

  // DOC-024 1 — PATCH /organizaciones/:id. Solo el nombre (cache de lo que ya cambio en Zitadel,
  // CIS lo llama despues de actualizar el nombre real ahi) — nunca el `id`.
  async actualizarNombre(id: string, nombre: string): Promise<Organizacion> {
    const actual = await this.findById(id);
    if (!actual) {
      throw new NotFoundException({
        message: `No existe la organizacion '${id}'`,
      });
    }
    await this.pool.query(
      'UPDATE organizaciones SET nombre = $1 WHERE id = $2',
      [nombre, id],
    );
    return { ...actual, nombre };
  }

  // DOC-024 1 — PATCH /organizaciones/:id/estado. Bidireccional, nunca DELETE (Tomo III 4.10) —
  // sin cascada a Contrato, ver DOC-024 1.
  async actualizarEstado(
    id: string,
    estado: EstadoOrganizacion,
  ): Promise<Organizacion> {
    const actual = await this.findById(id);
    if (!actual) {
      throw new NotFoundException({
        message: `No existe la organizacion '${id}'`,
      });
    }
    await this.pool.query(
      'UPDATE organizaciones SET estado = $1 WHERE id = $2',
      [estado, id],
    );
    return { ...actual, estado };
  }
}
