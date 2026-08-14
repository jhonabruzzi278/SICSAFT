import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { ScanResultado } from '../reglas/reglas.types';
import type { SesionEstado } from './inventarios.types';

export interface CrearSesionInput {
  id: string;
  idempotencyKey: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  correlationId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: SesionEstado;
  requestHash: string;
}

export interface FilaInventarioInput {
  id: string;
  codigoQr: string;
  activoId: string | null;
  resultado: ScanResultado;
  observaciones?: string;
}

export interface SesionExistente {
  id: string;
  estado: SesionEstado;
  requestHash: string;
}

export interface SesionEstadoInfo {
  estado: SesionEstado;
  ultimoIntento: string;
}

// RF-04 (Fase 5, WEB) — resumen de una sesion para el listado; `findEstado` ya cubria el detalle
// minimo (estado/ultimoIntento) pero no habia forma de saber que sesiones existen sin conocer su
// id de antemano.
export interface SesionResumen {
  id: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: SesionEstado;
  creadoEn: string;
}

export interface EscaneoDetalle {
  codigoQr: string;
  resultado: ScanResultado;
  observaciones: string | null;
}

export interface SesionDetalle extends SesionResumen {
  escaneos: EscaneoDetalle[];
}

// DOC-006 §3 — agrupa la sesion (`sesiones_inventario`) con sus filas de verificacion
// (`inventarios`, una por escaneo). `crear` es transaccional: o se persisten ambas cosas, o
// ninguna — un fallo a mitad de camino nunca deja una sesion sin sus escaneos.
@Injectable()
export class SesionInventarioRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SesionExistente | null> {
    const result = await this.pool.query<SesionExistente>(
      `SELECT id, estado, request_hash AS "requestHash"
       FROM sesiones_inventario WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    return result.rows[0] ?? null;
  }

  async findEstado(id: string): Promise<SesionEstadoInfo | null> {
    const result = await this.pool.query<{
      estado: SesionEstado;
      ultimoIntento: Date;
    }>(
      `SELECT estado, creado_en AS "ultimoIntento"
       FROM sesiones_inventario WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      estado: row.estado,
      ultimoIntento: row.ultimoIntento.toISOString(),
    };
  }

  // RF-04 — lista sesiones de una organizacion, mas recientes primero. Sin paginado todavia (RNF-01
  // ya lo exige para GET /catalogo — acá se difiere hasta tener volumen real de sesiones, YAGNI).
  async findByOrganizacion(organizacionId: string): Promise<SesionResumen[]> {
    const result = await this.pool.query<{
      id: string;
      organizacionId: string;
      areaId: string;
      ubicacionId: string;
      operadorId: string;
      fechaInicio: Date;
      fechaCierre: Date;
      estado: SesionEstado;
      creadoEn: Date;
    }>(
      `SELECT id, organizacion_id AS "organizacionId", area_id AS "areaId",
              ubicacion_id AS "ubicacionId", operador_id AS "operadorId",
              fecha_inicio AS "fechaInicio", fecha_cierre AS "fechaCierre", estado,
              creado_en AS "creadoEn"
       FROM sesiones_inventario
       WHERE organizacion_id = $1
       ORDER BY creado_en DESC`,
      [organizacionId],
    );
    return result.rows.map((row) => ({
      ...row,
      fechaInicio: row.fechaInicio.toISOString(),
      fechaCierre: row.fechaCierre.toISOString(),
      creadoEn: row.creadoEn.toISOString(),
    }));
  }

  // RF-04 — detalle de una sesion con sus escaneos (`inventarios`, una fila por escaneo, ver
  // DOC-006 §3). Null si no existe — el controller decide el 404 (mismo criterio que findEstado).
  async findDetalle(id: string): Promise<SesionDetalle | null> {
    const sesionResult = await this.pool.query<{
      id: string;
      organizacionId: string;
      areaId: string;
      ubicacionId: string;
      operadorId: string;
      fechaInicio: Date;
      fechaCierre: Date;
      estado: SesionEstado;
      creadoEn: Date;
    }>(
      `SELECT id, organizacion_id AS "organizacionId", area_id AS "areaId",
              ubicacion_id AS "ubicacionId", operador_id AS "operadorId",
              fecha_inicio AS "fechaInicio", fecha_cierre AS "fechaCierre", estado,
              creado_en AS "creadoEn"
       FROM sesiones_inventario WHERE id = $1`,
      [id],
    );
    const sesion = sesionResult.rows[0];
    if (!sesion) {
      return null;
    }

    const escaneosResult = await this.pool.query<EscaneoDetalle>(
      `SELECT codigo_qr AS "codigoQr", resultado, observaciones
       FROM inventarios WHERE sesion_id = $1 ORDER BY codigo_qr`,
      [id],
    );

    return {
      ...sesion,
      fechaInicio: sesion.fechaInicio.toISOString(),
      fechaCierre: sesion.fechaCierre.toISOString(),
      creadoEn: sesion.creadoEn.toISOString(),
      escaneos: escaneosResult.rows,
    };
  }

  async crear(
    sesion: CrearSesionInput,
    filas: readonly FilaInventarioInput[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO sesiones_inventario
           (id, idempotency_key, organizacion_id, area_id, ubicacion_id, operador_id,
            correlation_id, fecha_inicio, fecha_cierre, estado, request_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          sesion.id,
          sesion.idempotencyKey,
          sesion.organizacionId,
          sesion.areaId,
          sesion.ubicacionId,
          sesion.operadorId,
          sesion.correlationId,
          sesion.fechaInicio,
          sesion.fechaCierre,
          sesion.estado,
          sesion.requestHash,
        ],
      );

      for (const fila of filas) {
        await client.query(
          `INSERT INTO inventarios
             (id, sesion_id, activo_id, codigo_qr, fecha, usuario, metodo, resultado,
              observaciones)
           VALUES ($1, $2, $3, $4, $5, $6, 'qr', $7, $8)`,
          [
            fila.id,
            sesion.id,
            fila.activoId,
            fila.codigoQr,
            sesion.fechaCierre,
            sesion.operadorId,
            fila.resultado,
            fila.observaciones ?? null,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
