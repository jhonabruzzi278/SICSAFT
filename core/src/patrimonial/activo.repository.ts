import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  Activo,
  ActivoCatalogo,
  CatalogoFiltro,
  CatalogoPagina,
  EstadoActivo,
  NuevoActivoInput,
} from './activo.types';

// Mismos codigos SQLSTATE que inventarios.service.ts (sin paquete compartido entre modulos de
// este mismo desplegable para algo tan chico, ver criterio ya aplicado ahi).
const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const SELECT_ACTIVO_SQL = `
  SELECT
    a.id,
    a.codigo_patrimonial AS "codigoPatrimonial",
    a.codigo_qr AS "codigoQr",
    a.serie,
    a.organizacion_id AS "organizacionId",
    a.area_id AS "areaId",
    a.ubicacion_id AS "ubicacionId",
    a.responsable_id AS "responsableId",
    a.estado,
    a.descripcion,
    (SELECT MAX(i.fecha) FROM inventarios i WHERE i.activo_id = a.id) AS "ultimoInventario",
    c.tipo,
    c.familia,
    c.subfamilia,
    c.marca,
    c.modelo
  FROM activos a
  JOIN catalogo_activos c ON c.id = a.catalogo_id
`;

interface ActivoRow {
  id: string;
  codigoPatrimonial: string;
  codigoQr: string;
  serie: string | null;
  organizacionId: string;
  areaId: string | null;
  ubicacionId: string | null;
  responsableId: string | null;
  estado: EstadoActivo;
  descripcion: string | null;
  ultimoInventario: string | null;
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
}

// DOC-006 2: `nombre` no es un campo propio de catalogo_activos — se compone. Prioridad:
// marca+modelo (mas especifico) > subfamilia > "tipo — familia" (siempre disponibles, ultimo
// recurso).
export function construirNombreActivo(row: {
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
}): string {
  if (row.marca && row.modelo) {
    return `${row.marca} ${row.modelo}`;
  }
  if (row.subfamilia) {
    return row.subfamilia;
  }
  return `${row.tipo} — ${row.familia}`;
}

@Injectable()
export class ActivoRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // DOC-008: recibe organizacionId porque un codigoQr fuera de esa organizacion debe tratarse
  // como no_registrado (DOC-009), no filtrarse a nivel SQL exponiendo un activo de otra
  // organizacion en un error distinto.
  async findByCodigoQr(
    codigoQr: string,
    organizacionId: string,
  ): Promise<Activo | null> {
    const result = await this.pool.query<ActivoRow>(
      `${SELECT_ACTIVO_SQL} WHERE a.codigo_qr = $1 AND a.organizacion_id = $2`,
      [codigoQr, organizacionId],
    );
    const row = result.rows[0];
    return row ? this.toActivo(row) : null;
  }

  // DOC-009 nota 2: el UNIQUE de activos.codigo_qr ya impide duplicados por el camino normal de
  // alta — este metodo es defensivo, para cuando una importacion masiva (Fase 7,
  // CON-CONTABILIDAD) inserte datos sin pasar por esa validacion de aplicacion.
  async existeMasDeUnActivoConCodigoQr(codigoQr: string): Promise<boolean> {
    const result = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM activos WHERE codigo_qr = $1',
      [codigoQr],
    );
    return Number(result.rows[0]?.total ?? '0') > 1;
  }

  // RNF-01: paginado, nunca un dataset completo sin limite. Solo activos con area/ubicacion
  // asignada — uno sin asignar no esta listo para aparecer en un catalogo operativo de escaneo
  // (DOC-006 2, ActivoCatalogo exige areaId/ubicacionId no nulos).
  async findCatalogo(filtro: CatalogoFiltro): Promise<CatalogoPagina> {
    const condiciones = [
      'a.organizacion_id = $1',
      'a.area_id IS NOT NULL',
      'a.ubicacion_id IS NOT NULL',
    ];
    const valores: unknown[] = [filtro.organizacionId];

    if (filtro.areaId) {
      valores.push(filtro.areaId);
      condiciones.push(`a.area_id = $${valores.length}`);
    }
    if (filtro.ubicacionId) {
      valores.push(filtro.ubicacionId);
      condiciones.push(`a.ubicacion_id = $${valores.length}`);
    }

    const whereSql = condiciones.join(' AND ');

    const totalResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM activos a WHERE ${whereSql}`,
      valores,
    );

    valores.push(filtro.limit, filtro.offset);
    const rowsResult = await this.pool.query<ActivoRow>(
      `${SELECT_ACTIVO_SQL} WHERE ${whereSql} ORDER BY a.codigo_patrimonial
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores,
    );

    return {
      total: Number(totalResult.rows[0]?.total ?? '0'),
      activos: rowsResult.rows.map((row) => this.toActivoCatalogo(row)),
    };
  }

  // DOC-012 6 — busca por codigoPatrimonial (clave de idempotencia de la importacion masiva:
  // "cada fila trae su propio codigoPatrimonial", nunca duplica al reintentar la misma fila).
  async findByCodigoPatrimonial(
    codigoPatrimonial: string,
  ): Promise<Activo | null> {
    const result = await this.pool.query<ActivoRow>(
      `${SELECT_ACTIVO_SQL} WHERE a.codigo_patrimonial = $1`,
      [codigoPatrimonial],
    );
    const row = result.rows[0];
    return row ? this.toActivo(row) : null;
  }

  // DOC-012 5 — busca por id (no por codigoQr como findByCodigoQr, ese es el camino de lectura
  // de APP QR). Usado por las 4 operaciones de escritura oficial para resolver 404 vs 400 antes
  // de decidir la transicion.
  async findById(id: string): Promise<Activo | null> {
    const result = await this.pool.query<ActivoRow>(
      `${SELECT_ACTIVO_SQL} WHERE a.id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? this.toActivo(row) : null;
  }

  // DOC-012 5 — POST /activos (alta, [*] -> activo). `estado`/`fecha_alta` los decide CORE, no
  // el cliente (CIS no confia datos crudos, mismo criterio que el resto del ecosistema).
  async crear(input: NuevoActivoInput): Promise<Activo> {
    const id = randomUUID();
    try {
      await this.pool.query(
        `INSERT INTO activos
           (id, codigo_patrimonial, codigo_qr, organizacion_id, catalogo_id, serie, estado,
            responsable_id, area_id, ubicacion_id, valor_patrimonial, fecha_alta, descripcion)
         VALUES ($1, $2, $3, $4, $5, $6, 'activo', $7, $8, $9, $10, CURRENT_DATE, $11)`,
        [
          id,
          input.codigoPatrimonial,
          input.codigoQr,
          input.organizacionId,
          input.catalogoId,
          input.serie ?? null,
          input.responsableId ?? null,
          input.areaId ?? null,
          input.ubicacionId ?? null,
          input.valorPatrimonial ?? null,
          input.descripcion ?? null,
        ],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException({
          message: 'Ya existe un activo con ese codigoPatrimonial o codigoQr',
        });
      }
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message:
            'organizacionId, catalogoId, responsableId, areaId o ubicacionId inexistente',
        });
      }
      throw error;
    }
    // Recien insertado con este mismo id — nunca null.
    return (await this.findById(id)) as Activo;
  }

  // DOC-012 5 — POST /activos/:id/baja (-> dado_de_baja) y POST /activos/:id/reincorporacion
  // (extraviado -> activo) comparten esta transicion generica: valida el estado de origen antes
  // de escribir (400 si no coincide, 404 si el activo no existe) en vez de dejar que un UPDATE
  // sin match silencioso pase desapercibido. `organizacionId` es la organizacion donde
  // OrquestadorService ya verifico el rol (verificarRolAdministradorPatrimonial) — se vuelve a
  // cruzar acá contra la organizacion REAL del activo (404 si no coincide, nunca 403, para no
  // confirmarle a un caller sin ese rol que el activo si existe en otra organizacion). Defensa en
  // profundidad: sin esto, un rol valido en la Organizacion A alcanzaba para escribir sobre
  // activos de la Organizacion B con solo conocer su id (hallazgo real de revision de seguridad).
  async cambiarEstado(
    id: string,
    organizacionId: string,
    estadosOrigenPermitidos: EstadoActivo[],
    estadoNuevo: EstadoActivo,
  ): Promise<Activo> {
    const actual = await this.findById(id);
    if (!actual || actual.organizacionId !== organizacionId) {
      throw new NotFoundException({ message: `No existe el activo '${id}'` });
    }
    if (!estadosOrigenPermitidos.includes(actual.estado)) {
      throw new BadRequestException({
        message: `El activo esta en estado '${actual.estado}', se esperaba uno de: ${estadosOrigenPermitidos.join(', ')}`,
      });
    }
    await this.pool.query('UPDATE activos SET estado = $1 WHERE id = $2', [
      estadoNuevo,
      id,
    ]);
    return { ...actual, estado: estadoNuevo };
  }

  // DOC-012 5 — PATCH /activos/:id/responsable. Sin cambio de estado (a diferencia de
  // cambiarEstado arriba). Mismo cruce por organizacionId que cambiarEstado, mismo motivo.
  async actualizarResponsable(
    id: string,
    organizacionId: string,
    responsableId: string,
  ): Promise<Activo> {
    const actual = await this.findById(id);
    if (!actual || actual.organizacionId !== organizacionId) {
      throw new NotFoundException({ message: `No existe el activo '${id}'` });
    }
    try {
      await this.pool.query(
        'UPDATE activos SET responsable_id = $1 WHERE id = $2',
        [responsableId, id],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message: `responsableId '${responsableId}' inexistente`,
        });
      }
      throw error;
    }
    return { ...actual, responsableId };
  }

  // DOC-021 3 — PATCH /activos/:id/descripcion. Mismo cruce por organizacionId que
  // actualizarResponsable, mismo motivo (defensa en profundidad).
  async actualizarDescripcion(
    id: string,
    organizacionId: string,
    descripcion: string | null,
  ): Promise<Activo> {
    const actual = await this.findById(id);
    if (!actual || actual.organizacionId !== organizacionId) {
      throw new NotFoundException({ message: `No existe el activo '${id}'` });
    }
    await this.pool.query('UPDATE activos SET descripcion = $1 WHERE id = $2', [
      descripcion,
      id,
    ]);
    return { ...actual, descripcion };
  }

  private toActivo(row: ActivoRow): Activo {
    return {
      id: row.id,
      codigoPatrimonial: row.codigoPatrimonial,
      codigoQr: row.codigoQr,
      serie: row.serie,
      organizacionId: row.organizacionId,
      areaId: row.areaId,
      ubicacionId: row.ubicacionId,
      responsableId: row.responsableId,
      estado: row.estado,
      descripcion: row.descripcion,
      ultimoInventario: row.ultimoInventario,
      catalogo: {
        tipo: row.tipo,
        familia: row.familia,
        subfamilia: row.subfamilia,
        marca: row.marca,
        modelo: row.modelo,
      },
    };
  }

  private toActivoCatalogo(row: ActivoRow): ActivoCatalogo {
    return {
      id: row.id,
      codigoQr: row.codigoQr,
      nombre: construirNombreActivo(row),
      familia: row.familia,
      organizacionId: row.organizacionId,
      // Seguro: findCatalogo ya filtra area_id/ubicacion_id IS NOT NULL.
      areaId: row.areaId as string,
      ubicacionId: row.ubicacionId as string,
      estado: row.estado,
    };
  }
}
