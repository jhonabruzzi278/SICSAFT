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
