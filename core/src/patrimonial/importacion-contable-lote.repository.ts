import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  DryRunFila,
  EstadoLote,
  FilaLoteImportacionContable,
  LoteConFilas,
  LoteImportacionContable,
  OrigenLote,
  ResumenLote,
} from './importacion-contable-lote.types';

// DOC-029 RF-B — acceso a la bandeja de staging. Idéntico patrón que area.repository.ts /
// contrato.repository.ts (SQL crudo, ids `text` con randomUUID). El alta del lote es atómica
// (lote + todas sus filas o nada) porque un lote a medias no sirve para revisar.

export interface FilaLoteParaCrear {
  linea: number;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId?: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
  direccionNombre?: string;
  areaNombre?: string;
  responsableNombre?: string;
  categoriaNombre?: string;
  nombreAft?: string;
  crudo: Record<string, string>;
  dryRunResultado: DryRunFila;
  dryRunMotivo: string | null;
}

interface FilaLoteRow {
  id: string;
  linea: number;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string | null;
  serie: string | null;
  responsableId: string | null;
  areaId: string | null;
  ubicacionId: string | null;
  valorPatrimonial: string | null;
  direccionNombre: string | null;
  areaNombre: string | null;
  responsableNombre: string | null;
  categoriaNombre: string | null;
  nombreAft: string | null;
  crudo: Record<string, string>;
  dryRunResultado: DryRunFila | null;
  dryRunMotivo: string | null;
}

const SELECT_LOTE_SQL = `
  SELECT id, organizacion_id AS "organizacionId", origen,
         archivo_nombre AS "archivoNombre", recibido_en AS "recibidoEn", estado,
         revisado_por AS "revisadoPor", revisado_en AS "revisadoEn",
         motivo_rechazo AS "motivoRechazo", resumen
  FROM importacion_contable_lote`;

const SELECT_FILA_SQL = `
  SELECT id, linea, codigo_patrimonial AS "codigoPatrimonial",
         codigo_qr AS "codigoQr", catalogo_id AS "catalogoId", serie,
         responsable_id AS "responsableId", area_id AS "areaId",
         ubicacion_id AS "ubicacionId", valor_patrimonial AS "valorPatrimonial",
         direccion_nombre AS "direccionNombre", area_nombre AS "areaNombre",
         responsable_nombre AS "responsableNombre", categoria_nombre AS "categoriaNombre",
         nombre_aft AS "nombreAft",
         crudo, dry_run_resultado AS "dryRunResultado", dry_run_motivo AS "dryRunMotivo"
  FROM importacion_contable_lote_fila`;

function resumenDeFilas(filas: readonly FilaLoteParaCrear[]): ResumenLote {
  return {
    totalFilas: filas.length,
    crear: filas.filter((f) => f.dryRunResultado === 'crear').length,
    yaImportado: filas.filter((f) => f.dryRunResultado === 'ya_importado')
      .length,
    conflicto: filas.filter((f) => f.dryRunResultado === 'conflicto').length,
  };
}

function mapearFila(row: FilaLoteRow): FilaLoteImportacionContable {
  return {
    id: row.id,
    linea: row.linea,
    codigoPatrimonial: row.codigoPatrimonial,
    codigoQr: row.codigoQr,
    catalogoId: row.catalogoId,
    serie: row.serie,
    responsableId: row.responsableId,
    areaId: row.areaId,
    ubicacionId: row.ubicacionId,
    valorPatrimonial:
      row.valorPatrimonial === null ? null : Number(row.valorPatrimonial),
    direccionNombre: row.direccionNombre,
    areaNombre: row.areaNombre,
    responsableNombre: row.responsableNombre,
    categoriaNombre: row.categoriaNombre,
    nombreAft: row.nombreAft,
    crudo: row.crudo,
    dryRunResultado: row.dryRunResultado,
    dryRunMotivo: row.dryRunMotivo,
  };
}

@Injectable()
export class ImportacionContableLoteRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async crear(input: {
    organizacionId: string;
    origen: OrigenLote;
    archivoNombre: string | null;
    filas: readonly FilaLoteParaCrear[];
  }): Promise<{ loteId: string; resumen: ResumenLote }> {
    const loteId = randomUUID();
    const resumen = resumenDeFilas(input.filas);
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(
        `INSERT INTO importacion_contable_lote
           (id, organizacion_id, origen, archivo_nombre, resumen)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          loteId,
          input.organizacionId,
          input.origen,
          input.archivoNombre,
          JSON.stringify(resumen),
        ],
      );
      for (const fila of input.filas) {
        await cliente.query(
          `INSERT INTO importacion_contable_lote_fila
             (id, lote_id, linea, codigo_patrimonial, codigo_qr, catalogo_id,
              serie, responsable_id, area_id, ubicacion_id, valor_patrimonial,
              direccion_nombre, area_nombre, responsable_nombre, categoria_nombre,
              nombre_aft, crudo, dry_run_resultado, dry_run_motivo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                   $15, $16, $17, $18, $19)`,
          [
            randomUUID(),
            loteId,
            fila.linea,
            fila.codigoPatrimonial,
            fila.codigoQr,
            fila.catalogoId ?? null,
            fila.serie ?? null,
            fila.responsableId ?? null,
            fila.areaId ?? null,
            fila.ubicacionId ?? null,
            fila.valorPatrimonial ?? null,
            fila.direccionNombre ?? null,
            fila.areaNombre ?? null,
            fila.responsableNombre ?? null,
            fila.categoriaNombre ?? null,
            fila.nombreAft ?? null,
            JSON.stringify(fila.crudo),
            fila.dryRunResultado,
            fila.dryRunMotivo,
          ],
        );
      }
      await cliente.query('COMMIT');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
    return { loteId, resumen };
  }

  async listar(
    organizacionId: string,
    estado?: EstadoLote,
  ): Promise<LoteImportacionContable[]> {
    const condiciones = ['organizacion_id = $1'];
    const valores: unknown[] = [organizacionId];
    if (estado) {
      valores.push(estado);
      condiciones.push(`estado = $${valores.length}`);
    }
    const { rows } = await this.pool.query<LoteImportacionContable>(
      `${SELECT_LOTE_SQL} WHERE ${condiciones.join(
        ' AND ',
      )} ORDER BY recibido_en DESC`,
      valores,
    );
    return rows;
  }

  async obtener(loteId: string): Promise<LoteConFilas | null> {
    const { rows } = await this.pool.query<LoteImportacionContable>(
      `${SELECT_LOTE_SQL} WHERE id = $1`,
      [loteId],
    );
    if (rows.length === 0) return null;
    const { rows: filas } = await this.pool.query<FilaLoteRow>(
      `${SELECT_FILA_SQL} WHERE lote_id = $1 ORDER BY linea`,
      [loteId],
    );
    return { lote: rows[0], filas: filas.map(mapearFila) };
  }

  // Marca el cierre de la revisión. `estado` distinto de `pendiente_revision`. No borra filas: el
  // lote queda como evidencia de qué se aprobó/rechazó y quién (§12.35.4).
  async marcarRevisado(
    loteId: string,
    estado: Extract<EstadoLote, 'aprobado' | 'rechazado'>,
    revisadoPor: string,
    motivoRechazo: string | null,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE importacion_contable_lote
         SET estado = $2, revisado_por = $3, revisado_en = now(), motivo_rechazo = $4
       WHERE id = $1`,
      [loteId, estado, revisadoPor, motivoRechazo],
    );
  }
}
