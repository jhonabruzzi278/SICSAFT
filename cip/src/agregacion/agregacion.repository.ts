import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { Veredicto } from './veredicto';

export interface EstadoResumenFila {
  estado: string;
  cantidad: number;
}

export interface CategoriaResumenFila {
  areaId: string;
  familia: string;
  cantidad: number;
}

// DOC-018 5 — escrituras del worker de agregacion. Cada metodo es deliberadamente una operacion
// chica y con nombre propio (no una unica clase "AgregacionRepository.guardarTodo") para que el
// AgregacionService (que orquesta el orden por tipo de mensaje) quede legible.
@Injectable()
export class AgregacionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async upsertVeredictoSesion(input: {
    sesionId: string;
    organizacionId: string;
    areaId: string;
    veredicto: Veredicto;
    fechaCierre: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO veredicto_sesion (sesion_id, organizacion_id, area_id, veredicto, fecha_cierre)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sesion_id) DO UPDATE SET
         organizacion_id = EXCLUDED.organizacion_id,
         area_id = EXCLUDED.area_id,
         veredicto = EXCLUDED.veredicto,
         fecha_cierre = EXCLUDED.fecha_cierre`,
      [
        input.sesionId,
        input.organizacionId,
        input.areaId,
        input.veredicto,
        input.fechaCierre,
      ],
    );
  }

  async upsertControlArea(
    areaId: string,
    organizacionId: string,
    ultimaSesionEn: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO control_area (area_id, organizacion_id, controlada_en_periodo, ultima_sesion_en)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (area_id) DO UPDATE SET
         organizacion_id = EXCLUDED.organizacion_id,
         controlada_en_periodo = true,
         ultima_sesion_en = EXCLUDED.ultima_sesion_en`,
      [areaId, organizacionId, ultimaSesionEn],
    );
  }

  // DOC-018 5.1 punto 4 — conteo incremental: un codigoQr ya visto no se vuelve a contar.
  async marcarEscaneadosAlgunaVez(
    organizacionId: string,
    codigosQr: readonly string[],
  ): Promise<void> {
    if (codigosQr.length === 0) {
      return;
    }
    await this.pool.query(
      `INSERT INTO activo_escaneado_alguna_vez (codigo_qr, organizacion_id)
       SELECT * FROM UNNEST($1::text[], $2::text[])
       ON CONFLICT (codigo_qr) DO NOTHING`,
      [codigosQr, codigosQr.map(() => organizacionId)],
    );
  }

  // Recalcula cobertura_organizacion completa — activosEscaneados sale de
  // activo_escaneado_alguna_vez (ya actualizada por marcarEscaneadosAlgunaVez si corresponde),
  // activosRegistrados lo trae el llamador (ya tiene el catalogo completo en memoria, DOC-018 5).
  async recalcularCobertura(
    organizacionId: string,
    activosRegistrados: number,
  ): Promise<void> {
    const resultado = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM activo_escaneado_alguna_vez WHERE organizacion_id = $1`,
      [organizacionId],
    );
    const activosEscaneados = Number(resultado.rows[0].count);
    const porcentaje =
      activosRegistrados > 0 ? activosEscaneados / activosRegistrados : 0;

    await this.pool.query(
      `INSERT INTO cobertura_organizacion (organizacion_id, activos_registrados, activos_escaneados, porcentaje_cobertura, actualizado_en)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (organizacion_id) DO UPDATE SET
         activos_registrados = EXCLUDED.activos_registrados,
         activos_escaneados = EXCLUDED.activos_escaneados,
         porcentaje_cobertura = EXCLUDED.porcentaje_cobertura,
         actualizado_en = now()`,
      [organizacionId, activosRegistrados, activosEscaneados, porcentaje],
    );
  }

  async upsertFueraDeArea(input: {
    codigoQr: string;
    organizacionId: string;
    areaRealId: string;
    areaEsperadaId: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO activo_fuera_de_area (codigo_qr, organizacion_id, area_real_id, area_esperada_id, detectado_en)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (codigo_qr) DO UPDATE SET
         organizacion_id = EXCLUDED.organizacion_id,
         area_real_id = EXCLUDED.area_real_id,
         area_esperada_id = EXCLUDED.area_esperada_id,
         detectado_en = now()`,
      [
        input.codigoQr,
        input.organizacionId,
        input.areaRealId,
        input.areaEsperadaId,
      ],
    );
  }

  async upsertIncidencia(input: {
    sesionId: string;
    codigoQr: string;
    organizacionId: string;
    observaciones: string;
    fecha: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO incidencia (sesion_id, codigo_qr, organizacion_id, observaciones, fecha)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sesion_id, codigo_qr) DO UPDATE SET
         observaciones = EXCLUDED.observaciones,
         fecha = EXCLUDED.fecha`,
      [
        input.sesionId,
        input.codigoQr,
        input.organizacionId,
        input.observaciones,
        input.fecha,
      ],
    );
  }

  // DELETE+INSERT completo por organizacion — DOC-018 4 "nota de diseño": se autocorrige ante un
  // evento perdido/duplicado, no arrastra contadores desincronizados.
  async reemplazarEstadoActivoResumen(
    organizacionId: string,
    filas: readonly EstadoResumenFila[],
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM estado_activo_resumen WHERE organizacion_id = $1`,
      [organizacionId],
    );
    if (filas.length === 0) {
      return;
    }
    await this.pool.query(
      `INSERT INTO estado_activo_resumen (organizacion_id, estado, cantidad)
       SELECT $1, * FROM UNNEST($2::text[], $3::int[])`,
      [
        organizacionId,
        filas.map((f) => f.estado),
        filas.map((f) => f.cantidad),
      ],
    );
  }

  async reemplazarCategoriaActivoResumen(
    organizacionId: string,
    filas: readonly CategoriaResumenFila[],
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM categoria_activo_resumen WHERE organizacion_id = $1`,
      [organizacionId],
    );
    if (filas.length === 0) {
      return;
    }
    await this.pool.query(
      `INSERT INTO categoria_activo_resumen (organizacion_id, area_id, familia, cantidad)
       SELECT $1, * FROM UNNEST($2::text[], $3::text[], $4::int[])`,
      [
        organizacionId,
        filas.map((f) => f.areaId),
        filas.map((f) => f.familia),
        filas.map((f) => f.cantidad),
      ],
    );
  }

  // No overwrite de `desde_en` para los que ya estaban extraviados — solo borra los que dejaron
  // de estarlo e inserta (ON CONFLICT DO NOTHING) los nuevos.
  async reemplazarActivoNoLocalizado(
    organizacionId: string,
    codigosQrExtraviados: readonly string[],
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM activo_no_localizado
       WHERE organizacion_id = $1 AND NOT (codigo_qr = ANY($2::text[]))`,
      [organizacionId, codigosQrExtraviados],
    );
    if (codigosQrExtraviados.length === 0) {
      return;
    }
    await this.pool.query(
      `INSERT INTO activo_no_localizado (codigo_qr, organizacion_id, desde_en)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::timestamptz[])
       ON CONFLICT (codigo_qr) DO NOTHING`,
      [
        codigosQrExtraviados,
        codigosQrExtraviados.map(() => organizacionId),
        codigosQrExtraviados.map(() => new Date().toISOString()),
      ],
    );
  }

  async actualizarSyncEstado(): Promise<void> {
    await this.pool.query(
      `UPDATE sync_estado SET ultimo_evento_procesado_en = now(), al_dia = true WHERE singleton = 'global'`,
    );
  }

  async obtenerSyncEstado(): Promise<{
    ultimoEventoProcesadoEn: string | null;
    alDia: boolean;
  }> {
    const resultado = await this.pool.query<{
      ultimo_evento_procesado_en: string | null;
      al_dia: boolean;
    }>(
      `SELECT ultimo_evento_procesado_en, al_dia FROM sync_estado WHERE singleton = 'global'`,
    );
    const fila = resultado.rows[0];
    return {
      ultimoEventoProcesadoEn: fila?.ultimo_evento_procesado_en ?? null,
      alDia: fila?.al_dia ?? true,
    };
  }

  // ARCHITECTURE.md 7 / DOC-018 5.4 — solo lo marca el watcher (eventos-outbox.worker.ts no lo
  // llama, solo confirma "al_dia = true" en cada mensaje procesado con exito).
  async marcarAtrasado(): Promise<void> {
    await this.pool.query(
      `UPDATE sync_estado SET al_dia = false WHERE singleton = 'global'`,
    );
  }
}
