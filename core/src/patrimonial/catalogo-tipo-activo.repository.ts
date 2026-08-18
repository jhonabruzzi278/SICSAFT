import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  CatalogoTipoActivo,
  NuevoCatalogoTipoActivoInput,
} from './catalogo-tipo-activo.types';

const SELECT_SQL = `
  SELECT
    id, tipo, familia, subfamilia, marca, modelo, fabricante,
    vida_util_meses AS "vidaUtilMeses", criticidad,
    tecnologia_identificacion AS "tecnologiaIdentificacion"
  FROM catalogo_activos
`;

// DOC-021 4 (gap "familias/categorías") — catalogo_activos ya existia desde la Fase 1
// (migracion 1755100000000) pero sin ningun repository/endpoint que lo leyera o escribiera
// directo (ActivoRepository solo lo JOINea para componer `nombre`). Sin organizacionId — es
// compartido entre organizaciones (mismo criterio de catalogo_activos original).
@Injectable()
export class CatalogoTipoActivoRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listar(): Promise<CatalogoTipoActivo[]> {
    const result = await this.pool.query<CatalogoTipoActivo>(
      `${SELECT_SQL} ORDER BY tipo, familia`,
    );
    return result.rows;
  }

  async crear(
    input: NuevoCatalogoTipoActivoInput,
  ): Promise<CatalogoTipoActivo> {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO catalogo_activos
         (id, tipo, familia, subfamilia, marca, modelo, fabricante, vida_util_meses,
          criticidad, tecnologia_identificacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        input.tipo,
        input.familia,
        input.subfamilia ?? null,
        input.marca ?? null,
        input.modelo ?? null,
        input.fabricante ?? null,
        input.vidaUtilMeses ?? null,
        input.criticidad,
        input.tecnologiaIdentificacion,
      ],
    );
    const result = await this.pool.query<CatalogoTipoActivo>(
      `${SELECT_SQL} WHERE id = $1`,
      [id],
    );
    // Recien insertado con este mismo id — nunca undefined.
    return result.rows[0];
  }
}
