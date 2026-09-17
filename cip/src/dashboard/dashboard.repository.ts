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
  ResumenDiarioResponse,
  ResumenVeredictosResponse,
  SyncInfo,
  VeredictoResumenResponse,
  VeredictoSesionResponse,
} from './dashboard.types';

// DOC-018 6 — lecturas contra las tablas de agregados. Nunca contra la Base Patrimonial
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
      revisado: boolean;
      revisado_por: string | null;
      revisado_en: string | null;
    }>(
      `SELECT sesion_id, area_id, veredicto, fecha_cierre, revisado, revisado_por, revisado_en
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
        revisado: fila.revisado,
        revisadoPor: fila.revisado_por,
        revisadoEn: fila.revisado_en,
      })),
    };
  }

  // Marca una sesión como revisada por el Directivo — acción final desde la UI (Pantalla 8),
  // sin endpoint de "des-revisar" (ver plan 2026-09-16). `revisadoPor` llega ya resuelto desde
  // CIS (claim de Keycloak) — CIP no modela identidad, solo lo persiste como texto libre.
  async marcarSesionRevisada(
    sesionId: string,
    revisadoPor: string,
  ): Promise<VeredictoSesionResponse | null> {
    const resultado = await this.pool.query<{
      sesion_id: string;
      area_id: string;
      veredicto: string;
      fecha_cierre: string;
      revisado: boolean;
      revisado_por: string | null;
      revisado_en: string | null;
    }>(
      `UPDATE veredicto_sesion
       SET revisado = true, revisado_por = $2, revisado_en = now()
       WHERE sesion_id = $1
       RETURNING sesion_id, area_id, veredicto, fecha_cierre, revisado, revisado_por, revisado_en`,
      [sesionId, revisadoPor],
    );
    const fila = resultado.rows[0];
    if (!fila) return null;
    return {
      sesionId: fila.sesion_id,
      areaId: fila.area_id,
      veredicto: fila.veredicto,
      fechaCierre: fila.fecha_cierre,
      revisado: fila.revisado,
      revisadoPor: fila.revisado_por,
      revisadoEn: fila.revisado_en,
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
      sesion_id: string;
      area_real_id: string;
      area_esperada_id: string;
      veredicto: string;
      detectado_en: string;
    }>(
      `SELECT codigo_qr, sesion_id, area_real_id, area_esperada_id, veredicto, detectado_en
       FROM activo_fuera_de_area WHERE ${where}
       ORDER BY detectado_en DESC LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, limit, offset],
    );

    return {
      total: Number(total.rows[0].count),
      items: filas.rows.map((fila) => ({
        codigoQr: fila.codigo_qr,
        sesionId: fila.sesion_id,
        areaRealId: fila.area_real_id,
        areaEsperadaId: fila.area_esperada_id,
        veredicto: fila.veredicto,
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

  // RF-01 (extensión "Resumen" del CIP) — dos agrupados sobre la misma tabla `veredicto_sesion`:
  // "dia" filtra por `fecha_cierre >= date_trunc('day', now())`, "acumulado" no filtra. Se pide en
  // paralelo porque son dos lecturas independientes sobre la misma tabla, no una transacción.
  async resumenVeredictos(
    organizacionId: string,
  ): Promise<ResumenVeredictosResponse> {
    const [dia, acumulado] = await Promise.all([
      this.agruparVeredictos(organizacionId, true),
      this.agruparVeredictos(organizacionId, false),
    ]);
    return { dia, acumulado };
  }

  private async agruparVeredictos(
    organizacionId: string,
    soloHoy: boolean,
  ): Promise<{ total: number; porVeredicto: VeredictoResumenResponse[] }> {
    const filtroFecha = soloHoy
      ? `AND fecha_cierre >= date_trunc('day', now())`
      : '';
    const resultado = await this.pool.query<{
      veredicto: string;
      cantidad: string;
    }>(
      `SELECT veredicto, COUNT(*) AS cantidad FROM veredicto_sesion
       WHERE organizacion_id = $1 ${filtroFecha}
       GROUP BY veredicto ORDER BY veredicto`,
      [organizacionId],
    );
    const porVeredicto = resultado.rows.map((fila) => ({
      veredicto: fila.veredicto,
      cantidad: Number(fila.cantidad),
    }));
    return {
      total: porVeredicto.reduce((acc, v) => acc + v.cantidad, 0),
      porVeredicto,
    };
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

  // DOC-034 Parte B — serie histórica de cortes diarios (resumen_diario), más reciente primero.
  async listarHistorico(
    organizacionId: string,
    desde: string | undefined,
    hasta: string | undefined,
    limit: number,
    offset: number,
  ): Promise<Pagina<ResumenDiarioResponse>> {
    const condiciones = ['organizacion_id = $1'];
    const parametros: unknown[] = [organizacionId];
    if (desde) {
      parametros.push(desde);
      condiciones.push(`fecha >= $${parametros.length}`);
    }
    if (hasta) {
      parametros.push(hasta);
      condiciones.push(`fecha <= $${parametros.length}`);
    }
    const where = condiciones.join(' AND ');

    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM resumen_diario WHERE ${where}`,
      parametros,
    );
    const filas = await this.pool.query<{
      fecha: string;
      total_sesiones: number;
      exitoso: number;
      aceptable: number;
      defectuoso: number;
    }>(
      `SELECT fecha, total_sesiones, exitoso, aceptable, defectuoso
       FROM resumen_diario WHERE ${where}
       ORDER BY fecha DESC LIMIT $${parametros.length + 1} OFFSET $${parametros.length + 2}`,
      [...parametros, limit, offset],
    );

    return {
      total: Number(total.rows[0].count),
      items: filas.rows.map((fila) => ({
        fecha: fila.fecha,
        totalSesiones: fila.total_sesiones,
        exitoso: fila.exitoso,
        aceptable: fila.aceptable,
        defectuoso: fila.defectuoso,
      })),
    };
  }
}
