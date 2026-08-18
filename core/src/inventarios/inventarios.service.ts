import { randomUUID, createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivoRepository } from '../patrimonial/activo.repository';
import type { EstadoOperativoDeclarable } from '../patrimonial/activo.types';
import { EventoRepository } from '../eventos/evento.repository';
import { clasificarEscaneo } from '../reglas/clasificar-escaneo';
import { SesionInventarioRepository } from './sesion-inventario.repository';
import type { FilaInventarioInput } from './sesion-inventario.repository';
import type {
  InventarioEstadoResponse,
  InventarioRequest,
  PostInventarioResponse,
  SesionDetalle,
  SesionResumen,
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

    await this.registrarEventosDeEscaneo(filas, sesionId, payload);

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

  // RF-04 (Fase 5, WEB) — lectura pura, sin orquestacion/auditoria (mismo criterio que
  // obtenerEstado).
  listarSesiones(organizacionId: string): Promise<SesionResumen[]> {
    return this.sesionRepository.findByOrganizacion(organizacionId);
  }

  async obtenerDetalle(inventarioId: string): Promise<SesionDetalle> {
    const detalle = await this.sesionRepository.findDetalle(inventarioId);
    if (!detalle) {
      throw new NotFoundException({
        message: `No existe el inventario '${inventarioId}'`,
      });
    }
    return detalle;
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
    payload: InventarioRequest,
  ): Promise<void> {
    const escaneosPorCodigo = new Map(
      payload.escaneos.map((escaneo) => [escaneo.codigoQr, escaneo]),
    );
    // Un mismo codigoQr puede aparecer más de una vez en el payload (2da+ ocurrencia clasifica
    // 'ya_escaneado', DOC-009) — estadoDeclarado/bajaSugerida solo se aplican en la primera
    // ocurrencia real, para no repetir la transición/evento por cada repetición del mismo código
    // dentro de la misma sesión. No alcanzable desde APP QR hoy (dedupea por código del lado del
    // cliente), pero POST /inventarios es un contrato público (DOC-006) — se cubre igual.
    const yaAplicado = new Set<string>();

    // Solo los escaneos que resolvieron a un activo real generan evento — no_registrado/invalido
    // no tienen activo_id, y un evento sin activo no tiene sentido (DOC-010).
    for (const fila of filas) {
      if (!fila.activoId) {
        continue;
      }
      await this.eventoRepository.registrar({
        activoId: fila.activoId,
        tipo: 'escaneo_qr',
        usuario: payload.operadorId,
        detalle: { resultado: fila.resultado, sesionId },
      });

      if (yaAplicado.has(fila.codigoQr)) {
        continue;
      }
      yaAplicado.add(fila.codigoQr);

      const escaneo = escaneosPorCodigo.get(fila.codigoQr);
      if (escaneo?.estadoDeclarado) {
        await this.aplicarEstadoDeclarado(
          fila.activoId,
          payload.organizacionId,
          escaneo.estadoDeclarado,
          payload.operadorId,
        );
      }
      if (escaneo?.bajaSugerida) {
        await this.eventoRepository.registrar({
          activoId: fila.activoId,
          tipo: 'baja_sugerida',
          usuario: payload.operadorId,
          detalle: { motivo: escaneo.bajaSugerida.motivo, sesionId },
        });
      }
    }
  }

  // DOC-012 §5.1 — best-effort: si el activo ya cambió de estado entre el escaneo y este punto,
  // o no está en un estado operativo compatible (ej. ya está dado_de_baja), se ignora en
  // silencio en vez de abortar la sesión completa por un solo ítem. Nunca requiere el rol
  // administrador-patrimonial (Tomo III §1.4 ya se lo concede a APP QR).
  private async aplicarEstadoDeclarado(
    activoId: string,
    organizacionId: string,
    estadoDeclarado: EstadoOperativoDeclarable,
    operadorId: string,
  ): Promise<void> {
    try {
      await this.activoRepository.cambiarEstado(
        activoId,
        organizacionId,
        ['activo', 'mantenimiento', 'inactivo'],
        estadoDeclarado,
      );
      if (estadoDeclarado !== 'activo') {
        await this.eventoRepository.registrar({
          activoId,
          tipo: estadoDeclarado,
          usuario: operadorId,
          detalle: { origen: 'control_inventario' },
        });
      }
    } catch (error: unknown) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        return;
      }
      throw error;
    }
  }

  private hashRequest(payload: InventarioRequest): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }
}
