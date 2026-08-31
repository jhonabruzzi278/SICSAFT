import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { construirNombreActivo } from '../patrimonial/activo.repository';
import type { ScanResultado } from '../reglas/reglas.types';
import type { EstadoOperativoDeclarable } from '../patrimonial/activo.types';
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
  // DOC-029 RF-I — lo que el controlador declaró por este AFT durante el control. Se persiste
  // junto al escaneo (además de aplicarse como transición/evento) para poder reconstruir la
  // Pantalla 8 de esa sesión.
  estadoDeclarado?: EstadoOperativoDeclarable | null;
  bajaSugeridaMotivo?: string | null;
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

// DOC-029 RF-I (Pantalla 8) — agregación de una sesión de control para el informe de área.
export type TipoControl = 'ordinario' | 'extraordinario';

export interface EscaneoControl {
  codigoQr: string;
  nombre: string | null;
  tipo: TipoControl | null;
  resultado: ScanResultado;
}

export interface FueraDeAreaControl {
  codigoQr: string;
  nombre: string | null;
  tipo: TipoControl | null;
  areaRealNombre: string | null;
}

export interface FaltanteControl {
  codigoQr: string;
  nombre: string;
}

export interface PorEstadoDeclarado {
  enServicio: number;
  enMantenimiento: number;
  inactivo: number;
  baja: number;
}

export interface ResumenControlSesion {
  sesionId: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: SesionEstado;
  escaneados: number;
  delArea: number;
  activosDelArea: number;
  porEstadoDeclarado: PorEstadoDeclarado;
  escaneadosLista: EscaneoControl[];
  fueraDeArea: FueraDeAreaControl[];
  faltantes: FaltanteControl[];
}

const RESULTADOS_FUERA_DE_AREA: ReadonlySet<ScanResultado> = new Set([
  'otra_area',
  'otra_ubicacion',
]);

interface FilaEscaneoControlRow {
  codigoQr: string;
  resultado: ScanResultado;
  estadoDeclarado: EstadoOperativoDeclarable | null;
  bajaSugeridaMotivo: string | null;
  tecnologia: 'qr' | 'rfid' | 'qr_rfid' | null;
  tipo: string | null;
  familia: string | null;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
  areaRealNombre: string | null;
}

interface FilaCatalogoRow {
  codigoQr: string;
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
}

function tipoControlDe(
  tecnologia: FilaEscaneoControlRow['tecnologia'],
): TipoControl | null {
  if (tecnologia === null) return null;
  return tecnologia === 'qr' ? 'ordinario' : 'extraordinario';
}

function nombreDe(row: {
  tipo: string | null;
  familia: string | null;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
}): string | null {
  if (row.tipo === null || row.familia === null) return null;
  return construirNombreActivo({
    tipo: row.tipo,
    familia: row.familia,
    subfamilia: row.subfamilia,
    marca: row.marca,
    modelo: row.modelo,
  });
}

// DOC-006 3 — agrupa la sesion (`sesiones_inventario`) con sus filas de verificacion
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
  // DOC-006 3). Null si no existe — el controller decide el 404 (mismo criterio que findEstado).
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

  // DOC-029 RF-I (Pantalla 8) — agregación completa de una sesión de control: escaneados,
  // del-área (n), activos del área (denominador del %), desglose por estado declarado, lista de
  // escaneados con tipo ordinario/extraordinario, fuera-de-área con su área real, y faltantes.
  // El % y el veredicto los calcula el service (regla pura, DOC-017 2). Null si la sesión no
  // existe — el service traduce a 404.
  async findResumenControl(id: string): Promise<ResumenControlSesion | null> {
    const sesionResult = await this.pool.query<{
      id: string;
      organizacionId: string;
      areaId: string;
      ubicacionId: string;
      operadorId: string;
      fechaInicio: Date;
      fechaCierre: Date;
      estado: SesionEstado;
    }>(
      `SELECT id, organizacion_id AS "organizacionId", area_id AS "areaId",
              ubicacion_id AS "ubicacionId", operador_id AS "operadorId",
              fecha_inicio AS "fechaInicio", fecha_cierre AS "fechaCierre", estado
       FROM sesiones_inventario WHERE id = $1`,
      [id],
    );
    const sesion = sesionResult.rows[0];
    if (!sesion) {
      return null;
    }

    const escaneosResult = await this.pool.query<FilaEscaneoControlRow>(
      `SELECT i.codigo_qr AS "codigoQr", i.resultado,
              i.estado_declarado AS "estadoDeclarado",
              i.baja_sugerida_motivo AS "bajaSugeridaMotivo",
              c.tecnologia_identificacion AS "tecnologia",
              c.tipo, c.familia, c.subfamilia, c.marca, c.modelo,
              ar.nombre AS "areaRealNombre"
       FROM inventarios i
       LEFT JOIN activos a ON a.id = i.activo_id
       LEFT JOIN catalogo_activos c ON c.id = a.catalogo_id
       LEFT JOIN areas ar ON ar.id = a.area_id
       WHERE i.sesion_id = $1
       ORDER BY i.codigo_qr`,
      [id],
    );

    const activosDelAreaResult = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n
       FROM activos
       WHERE area_id = $1 AND estado <> 'dado_de_baja'`,
      [sesion.areaId],
    );

    const faltantesResult = await this.pool.query<FilaCatalogoRow>(
      `SELECT a.codigo_qr AS "codigoQr", c.tipo, c.familia, c.subfamilia, c.marca, c.modelo
       FROM activos a
       JOIN catalogo_activos c ON c.id = a.catalogo_id
       WHERE a.area_id = $1 AND a.estado <> 'dado_de_baja'
         AND a.id NOT IN (
           SELECT activo_id FROM inventarios
           WHERE sesion_id = $2 AND activo_id IS NOT NULL
         )
       ORDER BY a.codigo_qr`,
      [sesion.areaId, id],
    );

    const filas = escaneosResult.rows;
    const porEstadoDeclarado: PorEstadoDeclarado = {
      enServicio: filas.filter((f) => f.estadoDeclarado === 'activo').length,
      enMantenimiento: filas.filter(
        (f) => f.estadoDeclarado === 'mantenimiento',
      ).length,
      inactivo: filas.filter((f) => f.estadoDeclarado === 'inactivo').length,
      baja: filas.filter((f) => f.bajaSugeridaMotivo !== null).length,
    };

    return {
      sesionId: sesion.id,
      organizacionId: sesion.organizacionId,
      areaId: sesion.areaId,
      ubicacionId: sesion.ubicacionId,
      operadorId: sesion.operadorId,
      fechaInicio: sesion.fechaInicio.toISOString(),
      fechaCierre: sesion.fechaCierre.toISOString(),
      estado: sesion.estado,
      escaneados: filas.length,
      delArea: filas.filter((f) => f.resultado === 'correcto').length,
      activosDelArea: activosDelAreaResult.rows[0]?.n ?? 0,
      porEstadoDeclarado,
      escaneadosLista: filas.map((f) => ({
        codigoQr: f.codigoQr,
        nombre: nombreDe(f),
        tipo: tipoControlDe(f.tecnologia),
        resultado: f.resultado,
      })),
      fueraDeArea: filas
        .filter((f) => RESULTADOS_FUERA_DE_AREA.has(f.resultado))
        .map((f) => ({
          codigoQr: f.codigoQr,
          nombre: nombreDe(f),
          tipo: tipoControlDe(f.tecnologia),
          areaRealNombre: f.areaRealNombre,
        })),
      faltantes: faltantesResult.rows.map((f) => ({
        codigoQr: f.codigoQr,
        nombre: construirNombreActivo(f),
      })),
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
              observaciones, estado_declarado, baja_sugerida_motivo)
           VALUES ($1, $2, $3, $4, $5, $6, 'qr', $7, $8, $9, $10)`,
          [
            fila.id,
            sesion.id,
            fila.activoId,
            fila.codigoQr,
            sesion.fechaCierre,
            sesion.operadorId,
            fila.resultado,
            fila.observaciones ?? null,
            fila.estadoDeclarado ?? null,
            fila.bajaSugeridaMotivo ?? null,
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
