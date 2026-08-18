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
import { assertInvarianteSedeUnContratoVigente } from './contrato.seed';
import type {
  Contrato,
  ContratosPagina,
  EstadoContrato,
  ModuloContratado,
  NuevoContratoInput,
} from './contrato.types';
import type { Sede } from './entitlements.types';

// Mismos codigos SQLSTATE que activo.repository.ts.
const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// Una fila por contrato — las sedes cubiertas se agregan con json_agg para no traer N filas
// duplicadas por contrato (join contrato_sedes/sedes). Ver
// devops/local/postgres/init/schema/core.sql para el esquema real. `where` permite acotar a un
// solo contrato (findById) sin duplicar el resto de la consulta agregada.
function buildSelectContratosSql(where?: string): string {
  return `
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
    ${where ? `WHERE ${where}` : ''}
    GROUP BY c.id, c.organizacion_id, o.nombre, c.vigencia_desde, c.vigencia_hasta, c.estado,
      c.modulos_contratados
    ORDER BY c.id
  `;
}

const SELECT_CONTRATOS_SQL = buildSelectContratosSql();

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

// DOC-012 7 — solo estas 4 transiciones son validas (DOC-004 3): cualquier otra combinacion es
// 400. `vigente` es el unico estado de origen valido para 4 de las 4 transiciones — no hay forma
// de pasar de 'suspendido' a 'vencido'/'cancelado' directamente, ni de 'vencido'/'cancelado' a
// ningun otro estado (terminales).
const TRANSICIONES_VALIDAS: Record<EstadoContrato, EstadoContrato[]> = {
  vigente: ['suspendido', 'vencido', 'cancelado'],
  suspendido: ['vigente'],
  vencido: [],
  cancelado: [],
};

@Injectable()
export class ContratoRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findAll(): Promise<Contrato[]> {
    const result = await this.pool.query<ContratoRow>(SELECT_CONTRATOS_SQL);
    const contratos = result.rows.map((row) => this.toContrato(row));

    // Mismo invariante que se validaba sobre el seed en memoria (DOC-004 4) — acá es el punto
    // de validacion real porque la base de datos es un limite del sistema (dato externo, no
    // garantizado por TypeScript) y no hay endpoint de escritura todavia que lo prevenga antes.
    assertInvarianteSedeUnContratoVigente(contratos);

    return contratos;
  }

  // RNF-01 (cierra el gap) — GET /contratos paginado. Reusa findAll() (necesita el dataset
  // completo igual: el invariante DOC-004 4 se valida contra TODOS los contratos, no solo la
  // página pedida) y pagina en memoria — volumen bajo hoy (un Contrato por organizacion/sede), sin
  // costo real de traer todo a memoria; si el volumen crece, se reemplaza por LIMIT/OFFSET en SQL
  // manteniendo el invariante con una consulta separada.
  async findPagina(limit: number, offset: number): Promise<ContratosPagina> {
    const contratos = await this.findAll();
    return {
      contratos: contratos.slice(offset, offset + limit),
      total: contratos.length,
    };
  }

  // DOC-012 7 — usado por las 2 operaciones de escritura oficial para resolver 404 vs 400 antes
  // de decidir la transicion, mismo patron que ActivoRepository.findById.
  async findById(id: string): Promise<Contrato | null> {
    const result = await this.pool.query<ContratoRow>(
      buildSelectContratosSql('c.id = $1'),
      [id],
    );
    const row = result.rows[0];
    return row ? this.toContrato(row) : null;
  }

  // DOC-012 7 — POST /contratos (alta). `estado` lo decide CORE ('vigente'), nunca el cliente.
  // Valida el invariante DOC-004 4 ("una sede, un contrato vigente") ANTES de insertar — a
  // diferencia de findAll (que lo valida al leer, defensivo), acá se previene la violacion en
  // vez de solo detectarla despues.
  async crear(input: NuevoContratoInput): Promise<Contrato> {
    const sedesEnConflicto = await this.pool.query<{ sedeId: string }>(
      `SELECT DISTINCT cs.sede_id AS "sedeId"
       FROM contrato_sedes cs
       JOIN contratos c ON c.id = cs.contrato_id
       WHERE c.estado = 'vigente' AND cs.sede_id = ANY($1)`,
      [input.sedeIds],
    );
    if (sedesEnConflicto.rows.length > 0) {
      const sedes = sedesEnConflicto.rows.map((r) => r.sedeId).join(', ');
      throw new ConflictException({
        message: `Las sedes [${sedes}] ya estan cubiertas por otro contrato vigente (DOC-004 4)`,
      });
    }

    const id = randomUUID();
    // Transaccion real: sin esto, un FK invalido en contrato_sedes (2da sentencia) dejaba la
    // fila de contratos ya insertada (1ra sentencia) huerfana — un contrato 'vigente' sin
    // ninguna sede, invisible al invariante DOC-004 4 pero SI visible en GET /entitlements
    // (hallazgo real: rollback ausente detectado corriendo el e2e contra Postgres real).
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO contratos
           (id, organizacion_id, vigencia_desde, vigencia_hasta, estado, modulos_contratados)
         VALUES ($1, $2, $3, $4, 'vigente', $5)`,
        [
          id,
          input.organizacionId,
          input.vigenciaDesde,
          input.vigenciaHasta ?? null,
          input.modulosContratados,
        ],
      );
      for (const sedeId of input.sedeIds) {
        await client.query(
          'INSERT INTO contrato_sedes (contrato_id, sede_id) VALUES ($1, $2)',
          [id, sedeId],
        );
      }
      await client.query('COMMIT');
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message: 'organizacionId o alguna sedeId inexistente',
        });
      }
      if (esErrorPg(error) && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException({
          message: 'Ya existe un contrato con ese id',
        });
      }
      throw error;
    } finally {
      client.release();
    }
    // Recien insertado con este mismo id — nunca null.
    return (await this.findById(id)) as Contrato;
  }

  // DOC-012 7 — PATCH /contratos/:id. `organizacionId` es la organizacion donde
  // OrquestadorService ya verifico el rol — se vuelve a cruzar acá contra la organizacion REAL
  // del contrato objetivo (404 si no coincide, nunca 403), mismo criterio de defensa en
  // profundidad que ActivoRepository.cambiarEstado.
  async actualizarEstado(
    id: string,
    organizacionId: string,
    estadoNuevo: EstadoContrato,
  ): Promise<Contrato> {
    const actual = await this.findById(id);
    if (!actual || actual.organizacionId !== organizacionId) {
      throw new NotFoundException({ message: `No existe el contrato '${id}'` });
    }
    if (!TRANSICIONES_VALIDAS[actual.estado].includes(estadoNuevo)) {
      throw new BadRequestException({
        message: `Transicion invalida de '${actual.estado}' a '${estadoNuevo}' (DOC-004 3)`,
      });
    }
    await this.pool.query('UPDATE contratos SET estado = $1 WHERE id = $2', [
      estadoNuevo,
      id,
    ]);
    return { ...actual, estado: estadoNuevo };
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
