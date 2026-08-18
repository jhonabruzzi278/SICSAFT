import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  CategoriaResumenResponse,
  ControlAreaResponse,
  CoberturaResponse,
  EstadoResumenResponse,
  FueraDeAreaResponse,
  IncidenciaResponse,
  NoLocalizadoResponse,
  Pagina,
  SyncInfo,
  VeredictoSesionResponse,
} from './dashboard.types';

// DOC-018 §6 — lecturas contra las tablas de agregados. Nunca contra la Base Patrimonial
// transaccional (RNF-01) — este repositorio ni siquiera podria: solo tiene el pool de la base
// `cip`.
@Injectable()
export class DashboardRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async obtenerCobertura(
    organizacionId: string,
  ): Promise<Omit<CoberturaResponse, keyof SyncInfo> | null> {
    const resultado = await this.pool.query<{
      activos_registrados: number;
      activos_escaneados: number;
      porcentaje_cobertura: string;
    }>(
      `SELECT activos_registrados, activos_escaneados, porcentaje_cobertura
       FROM cobertura_organizacion WHERE organizacion_id = $1`,
      [organizacionId],
    );
    const fila = resultado.rows[0];
    if (!fila) {
      return null;
    }
    return {
      activosRegistrados: fila.activos_registrados,
      activosEscaneados: fila.activos_escaneados,
      porcentajeCobertura: Number(fila.porcentaje_cobertura),
    };
  }

  async listarAreas(organizacionId: string): Promise<ControlAreaResponse[]> {
    const resultado = await this.pool.query<{
      area_id: string;
      controlada_en_periodo: boolean;
      ultima_sesion_en: string | null;
    }>(
      `SELECT area_id, controlada_en_periodo, ultima_sesion_en
       FROM control_area WHERE organizacion_id = $1 ORDER BY area_id`,
      [organizacionId],
    );
    return resultado.rows.map((fila) => ({
      areaId: fila.area_id,
      controladaEnPeriodo: fila.controlada_en_periodo,
      ultimaSesionEn: fila.ultima_sesion_en,
    }));
  }

  async listarSesiones(
    organizacionId: string,
    areaId: string | undefined,
    limit: number,
    offset: number,
  ): Promise<Pagina<VeredictoSesionResponse>> {
    const condiciones = ['organizacion_id = $1'];
    const parametros: unknown[] = [organizacionId];
    if (areaId) {
      parametros.push(areaId);
      condiciones.push(`area_id = $${parametros.length}`);
    }
    const where = condiciones.join(' AND ');

    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM veredicto_sesion WHERE ${where}`,
      parametros,
    );
    const filas = await this.pool.query<{
      sesion_id: string;
      area_id: string;
      veredicto: string;
      fecha_cierre: string;
    }>(
      `SELECT sesion_id, area_id, veredicto, fecha_cierre
       FROM veredicto_sesion WHERE ${where}
       ORDER BY fecha_cierre DESC LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, limit, offset],
    );

    return {
      total: Number(total.rows[0].count),
      items: filas.rows.map((fila) => ({
        sesionId: fila.sesion_id,
        areaId: fila.area_id,
        veredicto: fila.veredicto,
        fechaCierre: fila.fecha_cierre,
      })),
    };
  }

  async listarFueraDeArea(
    organizacionId: string,
    areaId: string | undefined,
    limit: number,
    offset: number,
  ): Promise<Pagina<FueraDeAreaResponse>> {
    const condiciones = ['organizacion_id = $1'];
    const parametros: unknown[] = [organizacionId];
    if (areaId) {
      parametros.push(areaId);
      condiciones.push(`area_esperada_id = $${parametros.length}`);
    }
    const where = condiciones.join(' AND ');

    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM activo_fuera_de_area WHERE ${where}`,
      parametros,
    );
    const filas = await this.pool.query<{
      codigo_qr: string;
      area_real_id: string;
      area_esperada_id: string;
      detectado_en: string;
    }>(
      `SELECT codigo_qr, area_real_id, area_esperada_id, detectado_en
       FROM activo_fuera_de_area WHERE ${where}
       ORDER BY detectado_en DESC LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, limit, offset],
    );

    return {
      total: Number(total.rows[0].count),
      items: filas.rows.map((fila) => ({
        codigoQr: fila.codigo_qr,
        areaRealId: fila.area_real_id,
        areaEsperadaId: fila.area_esperada_id,
        detectadoEn: fila.detectado_en,
      })),
    };
  }

  async listarNoLocalizados(
    organizacionId: string,
    limit: number,
    offset: number,
  ): Promise<Pagina<NoLocalizadoResponse>> {
    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM activo_no_localizado WHERE organizacion_id = $1`,
      [organizacionId],
    );
    const filas = await this.pool.query<{
      codigo_qr: string;
      desde_en: string;
    }>(
      `SELECT codigo_qr, desde_en FROM activo_no_localizado
       WHERE organizacion_id = $1 ORDER BY desde_en ASC LIMIT $2 OFFSET $3`,
      [organizacionId, limit, offset],
    );

    return {
      total: Number(total.rows[0].count),
      items: filas.rows.map((fila) => ({
        codigoQr: fila.codigo_qr,
        desdeEn: fila.desde_en,
      })),
    };
  }

  async listarIncidencias(
    organizacionId: string,
    codigoQr: string | undefined,
    limit: number,
    offset: number,
  ): Promise<Pagina<IncidenciaResponse>> {
    const condiciones = ['organizacion_id = $1'];
    const parametros: unknown[] = [organizacionId];
    if (codigoQr) {
      parametros.push(codigoQr);
      condiciones.push(`codigo_qr = $${parametros.length}`);
    }
    const where = condiciones.join(' AND ');

    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM incidencia WHERE ${where}`,
      parametros,
    );
    const filas = await this.pool.query<{
      sesion_id: string;
      codigo_qr: string;
      observaciones: string;
      fecha: string;
    }>(
      `SELECT sesion_id, codigo_qr, observaciones, fecha
       FROM incidencia WHERE ${where}
       ORDER BY fecha DESC LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, limit, offset],
    );

    return {
      total: Number(total.rows[0].count),
      items: filas.rows.map((fila) => ({
        sesionId: fila.sesion_id,
        codigoQr: fila.codigo_qr,
        observaciones: fila.observaciones,
        fecha: fila.fecha,
      })),
    };
  }

  async listarEstadoActivos(
    organizacionId: string,
  ): Promise<EstadoResumenResponse[]> {
    const resultado = await this.pool.query<{
      estado: string;
      cantidad: number;
    }>(
      `SELECT estado, cantidad FROM estado_activo_resumen
       WHERE organizacion_id = $1 ORDER BY estado`,
      [organizacionId],
    );
    return resultado.rows.map((fila) => ({
      estado: fila.estado,
      cantidad: fila.cantidad,
    }));
  }

  async listarCategorias(
    organizacionId: string,
    areaId: string | undefined,
  ): Promise<CategoriaResumenResponse[]> {
    const parametros: unknown[] = [organizacionId, areaId ?? '(todas)'];
    const resultado = await this.pool.query<{
      area_id: string;
      familia: string;
      cantidad: number;
    }>(
      `SELECT area_id, familia, cantidad FROM categoria_activo_resumen
       WHERE organizacion_id = $1 AND area_id = $2 ORDER BY familia`,
      parametros,
    );
    return resultado.rows.map((fila) => ({
      areaId: fila.area_id,
      familia: fila.familia,
      cantidad: fila.cantidad,
    }));
  }

  async obtenerSyncInfo(): Promise<SyncInfo> {
    const resultado = await this.pool.query<{
      ultimo_evento_procesado_en: string | null;
      al_dia: boolean;
    }>(
      `SELECT ultimo_evento_procesado_en, al_dia FROM sync_estado WHERE singleton = 'global'`,
    );
    const fila = resultado.rows[0];
    return {
      actualizadoEn: fila?.ultimo_evento_procesado_en ?? null,
      alDia: fila?.al_dia ?? true,
    };
  }
}
