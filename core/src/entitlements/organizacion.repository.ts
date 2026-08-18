import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  NuevaOrganizacionInput,
  Organizacion,
} from './organizacion.types';

const UNIQUE_VIOLATION = '23505';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

@Injectable()
export class OrganizacionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listar(): Promise<Organizacion[]> {
    const result = await this.pool.query<Organizacion>(
      'SELECT id, nombre FROM organizaciones ORDER BY nombre',
    );
    return result.rows;
  }

  // `id` lo decide el cliente (= org_id real de Zitadel, DOC-021 § organizacion.schemas.ts) — a
  // diferencia de Activo/Contrato/CatalogoTipo, donde CORE siempre genera el id.
  async crear(input: NuevaOrganizacionInput): Promise<Organizacion> {
    try {
      await this.pool.query(
        'INSERT INTO organizaciones (id, nombre) VALUES ($1, $2)',
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
    return { id: input.id, nombre: input.nombre };
  }
}
