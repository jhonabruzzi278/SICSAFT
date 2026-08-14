import { randomUUID, createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivoRepository } from '../patrimonial/activo.repository';
import { EventoRepository } from '../eventos/evento.repository';
import { clasificarEscaneo } from '../reglas/clasificar-escaneo';
import { SesionInventarioRepository } from './sesion-inventario.repository';
import type { FilaInventarioInput } from './sesion-inventario.repository';
import type {
  InventarioEstadoResponse,
  InventarioRequest,
  PostInventarioResponse,
} from './inventarios.types';

// Codigo SQLSTATE de Postgres para violacion de foreign key — ver DOC-006 §5: una
// organizacion/area/ubicacion inexistente es 400, no un 500 crudo de Postgres.
const FOREIGN_KEY_VIOLATION = '23503';
// Violacion de UNIQUE — carrera entre dos requests con el mismo idempotencyKey.
const UNIQUE_VIOLATION = '23505';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

// DOC-006 §3 + DOC-007 — invocado por OrquestadorService, no directo desde el controller
// (RF-06). La idempotencia se resuelve antes de tocar el Motor de Reglas (ver
// core/aidlc-docs/design-artifacts/ARCHITECTURE.md, secuencia completa).
@Injectable()
export class InventariosService {
  constructor(
    private readonly sesionRepository: SesionInventarioRepository,
    private readonly activoRepository: ActivoRepository,
    private readonly eventoRepository: EventoRepository,
  ) {}

  async procesar(payload: InventarioRequest): Promise<PostInventarioResponse> {
    const requestHash = this.hashRequest(payload);
    const existente = await this.sesionRepository.findByIdempotencyKey(
      payload.idempotencyKey,
    );
    if (existente) {
      return this.resolverReintento(existente, requestHash, payload);
    }

    const filas = await this.clasificarEscaneos(payload);
    const sesionId = randomUUID();

    try {
      await this.sesionRepository.crear(
        {
          id: sesionId,
          idempotencyKey: payload.idempotencyKey,
          organizacionId: payload.organizacionId,
          areaId: payload.areaId,
          ubicacionId: payload.ubicacionId,
          operadorId: payload.operadorId,
          correlationId: payload.correlationId,
          fechaInicio: payload.fechaInicio,
          fechaCierre: payload.fechaCierre,
          estado: 'recibido',
          requestHash,
        },
        filas,
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message: 'Rechazado: organización, área o ubicación inexistente',
          errores: [
            {
              campo: 'organizacionId|areaId|ubicacionId',
              detalle:
                'Alguno de los identificadores de la sesión no existe en la Base Patrimonial',
            },
          ],
        });
      }
      if (esErrorPg(error) && error.code === UNIQUE_VIOLATION) {
        // Carrera: otra request con el mismo idempotencyKey ya se persistio entre el
        // findByIdempotencyKey de arriba y este insert — se resuelve igual que un reintento.
        const yaCreada = await this.sesionRepository.findByIdempotencyKey(
          payload.idempotencyKey,
        );
        if (yaCreada) {
          return this.resolverReintento(yaCreada, requestHash, payload);
        }
      }
      throw error;
    }

    await this.registrarEventosDeEscaneo(filas, sesionId, payload.operadorId);

    return { inventarioId: sesionId, estado: 'recibido' };
  }

  async obtenerEstado(inventarioId: string): Promise<InventarioEstadoResponse> {
    const info = await this.sesionRepository.findEstado(inventarioId);
    if (!info) {
      throw new NotFoundException({
        message: `No existe el inventario '${inventarioId}'`,
      });
    }
    return info;
  }

  private resolverReintento(
    existente: {
      id: string;
      estado: PostInventarioResponse['estado'];
      requestHash: string;
    },
    requestHash: string,
    payload: InventarioRequest,
  ): PostInventarioResponse {
    if (existente.requestHash !== requestHash) {
      // DOC-002 §5: idempotencyKey reutilizada con payload distinto es bug de cliente.
      throw new ConflictException({
        message: 'idempotencyKey ya usada con un payload distinto',
        correlationId: payload.correlationId,
      });
    }
    // Mismo payload, misma key: reintento legitimo — se devuelve el resultado ya procesado,
    // nunca se reclasifica ni se duplica (DOC-002 §4).
    return { inventarioId: existente.id, estado: existente.estado };
  }

  private async clasificarEscaneos(
    payload: InventarioRequest,
  ): Promise<FilaInventarioInput[]> {
    const yaClasificados = new Set<string>();
    const filas: FilaInventarioInput[] = [];

    for (const escaneo of payload.escaneos) {
      const activo = await this.activoRepository.findByCodigoQr(
        escaneo.codigoQr,
        payload.organizacionId,
      );
      const duplicado =
        await this.activoRepository.existeMasDeUnActivoConCodigoQr(
          escaneo.codigoQr,
        );
      const incidencia = payload.incidencias.find(
        (i) => i.codigoQr === escaneo.codigoQr,
      );

      const resultado = clasificarEscaneo({
        codigoQr: escaneo.codigoQr,
        activo,
        duplicado,
        yaClasificados,
        sesionAreaId: payload.areaId,
        sesionUbicacionId: payload.ubicacionId,
        tieneIncidencia: incidencia !== undefined,
      });
      yaClasificados.add(escaneo.codigoQr);

      filas.push({
        id: randomUUID(),
        codigoQr: escaneo.codigoQr,
        activoId: activo?.id ?? null,
        resultado,
        observaciones: incidencia?.descripcion,
      });
    }

    return filas;
  }

  private async registrarEventosDeEscaneo(
    filas: readonly FilaInventarioInput[],
    sesionId: string,
    operadorId: string,
  ): Promise<void> {
    // Solo los escaneos que resolvieron a un activo real generan evento — no_registrado/invalido
    // no tienen activo_id, y un evento sin activo no tiene sentido (DOC-010).
    for (const fila of filas) {
      if (fila.activoId) {
        await this.eventoRepository.registrar({
          activoId: fila.activoId,
          tipo: 'escaneo_qr',
          usuario: operadorId,
          detalle: { resultado: fila.resultado, sesionId },
        });
      }
    }
  }

  private hashRequest(payload: InventarioRequest): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
