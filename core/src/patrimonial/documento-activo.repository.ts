import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  DocumentoActivo,
  NuevoDocumentoActivoInput,
} from './documento-activo.types';

const SELECT_SQL = `
  SELECT
    id, activo_id AS "activoId", organizacion_id AS "organizacionId", tipo, url, descripcion,
    creado_en AS "creadoEn", creado_por AS "creadoPor"
  FROM documentos_activo
`;

// DOC-021 3 — cruza organizacionId contra el Activo real antes de insertar/eliminar, mismo
// criterio de defensa en profundidad que ActivoRepository (404, no 403, si no coincide).
@Injectable()
export class DocumentoActivoRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listarPorActivo(
    activoId: string,
    organizacionId: string,
  ): Promise<DocumentoActivo[]> {
    await this.verificarActivoEnOrganizacion(activoId, organizacionId);
    const result = await this.pool.query<DocumentoActivo>(
      `${SELECT_SQL} WHERE activo_id = $1 ORDER BY creado_en DESC`,
      [activoId],
    );
    return result.rows;
  }

  async crear(input: NuevoDocumentoActivoInput): Promise<DocumentoActivo> {
    await this.verificarActivoEnOrganizacion(
      input.activoId,
      input.organizacionId,
    );
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO documentos_activo
         (id, activo_id, organizacion_id, tipo, url, descripcion, creado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        input.activoId,
        input.organizacionId,
        input.tipo,
        input.url,
        input.descripcion ?? null,
        input.creadoPor,
      ],
    );
    const result = await this.pool.query<DocumentoActivo>(
      `${SELECT_SQL} WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

  async eliminar(
    documentoId: string,
    activoId: string,
    organizacionId: string,
  ): Promise<void> {
    await this.verificarActivoEnOrganizacion(activoId, organizacionId);
    const result = await this.pool.query(
      'DELETE FROM documentos_activo WHERE id = $1 AND activo_id = $2',
      [documentoId, activoId],
    );
    if (result.rowCount === 0) {
      throw new NotFoundException({
        message: `No existe el documento '${documentoId}' para el activo '${activoId}'`,
      });
    }
  }

  private async verificarActivoEnOrganizacion(
    activoId: string,
    organizacionId: string,
  ): Promise<void> {
    const result = await this.pool.query<{ organizacionId: string }>(
      'SELECT organizacion_id AS "organizacionId" FROM activos WHERE id = $1',
      [activoId],
    );
    const fila = result.rows[0];
    if (!fila || fila.organizacionId !== organizacionId) {
      throw new NotFoundException({
        message: `No existe el activo '${activoId}'`,
      });
    }
  }
}
