import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  Activo,
  ActivoCatalogo,
  CatalogoFiltro,
  CatalogoPagina,
  EstadoActivo,
} from './activo.types';

const SELECT_ACTIVO_SQL = `
  SELECT
    a.id,
    a.codigo_patrimonial AS "codigoPatrimonial",
    a.codigo_qr AS "codigoQr",
    a.organizacion_id AS "organizacionId",
    a.area_id AS "areaId",
    a.ubicacion_id AS "ubicacionId",
    a.estado,
    c.tipo,
    c.familia,
    c.subfamilia,
    c.marca,
    c.modelo
  FROM activos a
  JOIN catalogo_activos c ON c.id = a.catalogo_id
`;

interface ActivoRow {
  id: string;
  codigoPatrimonial: string;
  codigoQr: string;
  organizacionId: string;
  areaId: string | null;
  ubicacionId: string | null;
  estado: EstadoActivo;
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
}

// DOC-006 §2: `nombre` no es un campo propio de catalogo_activos — se compone. Prioridad:
// marca+modelo (mas especifico) > subfamilia > "tipo — familia" (siempre disponibles, ultimo
// recurso).
export function construirNombreActivo(row: {
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
}): string {
  if (row.marca && row.modelo) {
    return `${row.marca} ${row.modelo}`;
  }
  if (row.subfamilia) {
    return row.subfamilia;
  }
  return `${row.tipo} — ${row.familia}`;
}

@Injectable()
export class ActivoRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // DOC-008: recibe organizacionId porque un codigoQr fuera de esa organizacion debe tratarse
  // como no_registrado (DOC-009), no filtrarse a nivel SQL exponiendo un activo de otra
  // organizacion en un error distinto.
  async findByCodigoQr(
    codigoQr: string,
    organizacionId: string,
  ): Promise<Activo | null> {
    const result = await this.pool.query<ActivoRow>(
      `${SELECT_ACTIVO_SQL} WHERE a.codigo_qr = $1 AND a.organizacion_id = $2`,
      [codigoQr, organizacionId],
    );
    const row = result.rows[0];
    return row ? this.toActivo(row) : null;
  }

  // DOC-009 nota §2: el UNIQUE de activos.codigo_qr ya impide duplicados por el camino normal de
  // alta — este metodo es defensivo, para cuando una importacion masiva (Fase 7,
  // CON-CONTABILIDAD) inserte datos sin pasar por esa validacion de aplicacion.
  async existeMasDeUnActivoConCodigoQr(codigoQr: string): Promise<boolean> {
    const result = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM activos WHERE codigo_qr = $1',
      [codigoQr],
    );
    return Number(result.rows[0]?.total ?? '0') > 1;
  }

  // RNF-01: paginado, nunca un dataset completo sin limite. Solo activos con area/ubicacion
  // asignada — uno sin asignar no esta listo para aparecer en un catalogo operativo de escaneo
  // (DOC-006 §2, ActivoCatalogo exige areaId/ubicacionId no nulos).
  async findCatalogo(filtro: CatalogoFiltro): Promise<CatalogoPagina> {
    const condiciones = [
      'a.organizacion_id = $1',
      'a.area_id IS NOT NULL',
      'a.ubicacion_id IS NOT NULL',
    ];
    const valores: unknown[] = [filtro.organizacionId];

    if (filtro.areaId) {
      valores.push(filtro.areaId);
      condiciones.push(`a.area_id = $${valores.length}`);
    }
    if (filtro.ubicacionId) {
      valores.push(filtro.ubicacionId);
      condiciones.push(`a.ubicacion_id = $${valores.length}`);
    }

    const whereSql = condiciones.join(' AND ');

    const totalResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM activos a WHERE ${whereSql}`,
      valores,
    );

    valores.push(filtro.limit, filtro.offset);
    const rowsResult = await this.pool.query<ActivoRow>(
      `${SELECT_ACTIVO_SQL} WHERE ${whereSql} ORDER BY a.codigo_patrimonial
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores,
    );

    return {
      total: Number(totalResult.rows[0]?.total ?? '0'),
      activos: rowsResult.rows.map((row) => this.toActivoCatalogo(row)),
    };
  }

  private toActivo(row: ActivoRow): Activo {
    return {
      id: row.id,
      codigoPatrimonial: row.codigoPatrimonial,
      codigoQr: row.codigoQr,
      organizacionId: row.organizacionId,
      areaId: row.areaId,
      ubicacionId: row.ubicacionId,
      estado: row.estado,
      catalogo: {
        tipo: row.tipo,
        familia: row.familia,
        subfamilia: row.subfamilia,
        marca: row.marca,
        modelo: row.modelo,
      },
    };
  }

  private toActivoCatalogo(row: ActivoRow): ActivoCatalogo {
    return {
      codigoQr: row.codigoQr,
      nombre: construirNombreActivo(row),
      organizacionId: row.organizacionId,
      // Seguro: findCatalogo ya filtra area_id/ubicacion_id IS NOT NULL.
      areaId: row.areaId as string,
      ubicacionId: row.ubicacionId as string,
      estado: row.estado,
    };
  }
}
