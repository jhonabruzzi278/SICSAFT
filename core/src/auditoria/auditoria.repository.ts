import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  AuditoriaEntrada,
  AuditoriaFiltro,
  RegistrarAuditoriaInput,
} from './auditoria.types';

// RF-06 (Fase 5, WEB) — tope de filas de GET /auditoria: la tabla no tiene politica de
// retencion/purga todavia (Tomo III §4.10, ver DOC-011 § "Que NO resuelve"), asi que sin limite
// una organizacion con volumen real devolveria toda la historia del ecosistema en una sola
// respuesta. 200 alcanza para el primer incremento (RNF-01 ya exige paginado en GET /catalogo por
// volumen real medido; acá se difiere hasta tener el mismo problema, YAGNI).
const LISTAR_LIMITE = 200;

// DOC-011 — invocado una vez por transaccion, siempre, desde el Orquestador (DOC-007). Nunca
// desde un motor individual, para no duplicar el registro si un motor falla a mitad de camino.
@Injectable()
export class AuditoriaRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO auditoria (id, usuario, equipo, ip, operacion, resultado, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        input.usuario,
        input.equipo ?? null,
        input.ip ?? null,
        input.operacion,
        input.resultado,
        input.observaciones ?? null,
      ],
    );
  }

  // RF-06 — sin organizacionId en la tabla (ver auditoria.types.ts), asi que sin filtro de
  // organizacion todavia: mismo criterio ya aceptado en ContratoController.getContratos ("lectura
  // abierta, no hay 403 posible en este endpoint"). Filtros opcionales por usuario/operacion
  // (ILIKE, ver auditoria.types.ts) y rango de fecha — mismo patron de condiciones dinamicas que
  // ActivoRepository.findCatalogo. Mas recientes primero.
  async listar(filtro: AuditoriaFiltro = {}): Promise<AuditoriaEntrada[]> {
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

    const whereSql =
      condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    valores.push(LISTAR_LIMITE);

    const result = await this.pool.query<{
      id: string;
      usuario: string;
      fecha: Date;
      equipo: string | null;
      ip: string | null;
      operacion: string;
      resultado: string;
      observaciones: string | null;
    }>(
      `SELECT id, usuario, fecha, equipo, ip, operacion, resultado, observaciones
       FROM auditoria
       ${whereSql}
       ORDER BY fecha DESC
       LIMIT $${valores.length}`,
      valores,
    );
    return result.rows.map((row) => ({
      ...row,
      fecha: row.fecha.toISOString(),
    }));
  }
}
