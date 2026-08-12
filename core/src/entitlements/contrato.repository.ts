import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { assertInvarianteSedeUnContratoVigente } from './contrato.seed';
import type {
  Contrato,
  EstadoContrato,
  ModuloContratado,
} from './contrato.types';
import type { Sede } from './entitlements.types';

// Una fila por contrato — las sedes cubiertas se agregan con json_agg para no traer N filas
// duplicadas por contrato (join contrato_sedes/sedes). Ver
// devops/local/postgres/init/schema/core.sql para el esquema real.
const SELECT_CONTRATOS_SQL = `
  SELECT
    c.id,
    c.organizacion_id AS "organizacionId",
    o.nombre AS "organizacionNombre",
    c.vigencia_desde AS "vigenciaDesde",
    c.vigencia_hasta AS "vigenciaHasta",
    c.estado,
    c.modulos_contratados AS "modulosContratados",
    COALESCE(
      json_agg(json_build_object('id', s.id, 'nombre', s.nombre) ORDER BY s.id)
        FILTER (WHERE s.id IS NOT NULL),
      '[]'
    ) AS sedes
  FROM contratos c
  JOIN organizaciones o ON o.id = c.organizacion_id
  LEFT JOIN contrato_sedes cs ON cs.contrato_id = c.id
  LEFT JOIN sedes s ON s.id = cs.sede_id
  GROUP BY c.id, c.organizacion_id, o.nombre, c.vigencia_desde, c.vigencia_hasta, c.estado,
    c.modulos_contratados
  ORDER BY c.id
`;

interface ContratoRow {
  id: string;
  organizacionId: string;
  organizacionNombre: string;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  estado: EstadoContrato;
  modulosContratados: ModuloContratado[];
  sedes: Sede[];
}

@Injectable()
export class ContratoRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Contrato[]> {
    const result = await this.pool.query<ContratoRow>(SELECT_CONTRATOS_SQL);
    const contratos = result.rows.map((row) => this.toContrato(row));

    // Mismo invariante que se validaba sobre el seed en memoria (DOC-004 §4) — acá es el punto
    // de validacion real porque la base de datos es un limite del sistema (dato externo, no
    // garantizado por TypeScript) y no hay endpoint de escritura todavia que lo prevenga antes.
    assertInvarianteSedeUnContratoVigente(contratos);

    return contratos;
  }

  private toContrato(row: ContratoRow): Contrato {
    return {
      id: row.id,
      organizacionId: row.organizacionId,
      organizacionNombre: row.organizacionNombre,
      sedes: row.sedes,
      vigenciaDesde: row.vigenciaDesde.toISOString(),
      vigenciaHasta:
        row.vigenciaHasta === null ? null : row.vigenciaHasta.toISOString(),
      estado: row.estado,
      modulosContratados: row.modulosContratados,
    };
  }
}
