import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  AuditoriaFiltro,
  AuditoriaPagina,
  RegistrarAuditoriaInput,
} from './auditoria.types';

const FOREIGN_KEY_VIOLATION = '23503';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// DOC-011 — invocado una vez por transaccion, siempre, desde el Orquestador (DOC-007) para
// operaciones patrimoniales, y desde AuditoriaEscrituraController (DOC-024 3) para operaciones de
// identidad reportadas por CIS. Nunca desde un motor individual, para no duplicar el registro si
// un motor falla a mitad de camino.
@Injectable()
export class AuditoriaRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // DOC-024 3 — un evento de auditoria nunca debe poder tumbar la operacion que esta registrando:
  // si `organizacionId` referencia una organizacion que ya no existe o nunca existio (ej. un
  // 403 rechazado antes de confirmar que la organizacion objetivo era real), el INSERT falla por
  // FK — se reintenta una vez sin organizacionId en vez de propagar un 500.
  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    try {
      await this.insertar(input, input.organizacionId ?? null);
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        await this.insertar(input, null);
        return;
      }
      throw error;
    }
  }

  private async insertar(
    input: RegistrarAuditoriaInput,
    organizacionId: string | null,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO auditoria
         (id, usuario, equipo, ip, operacion, resultado, observaciones, categoria, organizacion_id,
          area_operativa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        randomUUID(),
        input.usuario,
        input.equipo ?? null,
        input.ip ?? null,
        input.operacion,
        input.resultado,
        input.observaciones ?? null,
        input.categoria ?? 'patrimonial',
        organizacionId,
        input.areaOperativa ?? null,
      ],
    );
  }

  // RF-06 — sin organizacionId en la tabla (ver auditoria.types.ts), asi que sin filtro de
  // organizacion todavia: mismo criterio ya aceptado en ContratoController.getContratos ("lectura
  // abierta, no hay 403 posible en este endpoint"). Filtros opcionales por usuario/operacion
  // (ILIKE, ver auditoria.types.ts) y rango de fecha — mismo patron de condiciones dinamicas que
  // ActivoRepository.findCatalogo. RNF-01 (cierra el gap) — paginado real via LIMIT/OFFSET, con
  // COUNT(*) sobre el mismo WHERE para el total. Mas recientes primero.
  async listar(filtro: AuditoriaFiltro): Promise<AuditoriaPagina> {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtro.usuario) {
      valores.push(`%${filtro.usuario}%`);
      condiciones.push(`usuario ILIKE $${valores.length}`);
    }
    if (filtro.operacion) {
      valores.push(`%${filtro.operacion}%`);
      condiciones.push(`operacion ILIKE $${valores.length}`);
    }
    if (filtro.fechaDesde) {
      valores.push(filtro.fechaDesde);
      condiciones.push(`fecha >= $${valores.length}`);
    }
    if (filtro.fechaHasta) {
      valores.push(filtro.fechaHasta);
      condiciones.push(`fecha <= $${valores.length}`);
    }
    if (filtro.categoria) {
      valores.push(filtro.categoria);
      condiciones.push(`categoria = $${valores.length}`);
    }
    if (filtro.organizacionId) {
      valores.push(filtro.organizacionId);
      condiciones.push(`organizacion_id = $${valores.length}`);
    }
    if (filtro.area) {
      valores.push(`%${filtro.area}%`);
      condiciones.push(`area_operativa ILIKE $${valores.length}`);
    }

    const whereSql =
      condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const totalResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM auditoria ${whereSql}`,
      valores,
    );

    const valoresPagina = [...valores, filtro.limit, filtro.offset];
    const result = await this.pool.query<{
      id: string;
      usuario: string;
      fecha: Date;
      equipo: string | null;
      ip: string | null;
      operacion: string;
      resultado: string;
      observaciones: string | null;
      categoria: 'patrimonial' | 'identidad';
      organizacionId: string | null;
      areaOperativa: string | null;
    }>(
      `SELECT id, usuario, fecha, equipo, ip, operacion, resultado, observaciones, categoria,
              organizacion_id AS "organizacionId", area_operativa AS "areaOperativa"
       FROM auditoria
       ${whereSql}
       ORDER BY fecha DESC
       LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}`,
      valoresPagina,
    );
    return {
      entradas: result.rows.map((row) => ({
        ...row,
        fecha: row.fecha.toISOString(),
      })),
      total: Number(totalResult.rows[0]?.total ?? '0'),
    };
  }
}
