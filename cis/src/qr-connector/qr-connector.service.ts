import { randomUUID, createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuthSessionRequest,
  CatalogoQuery,
  InventarioRequest,
} from './qr-connector.schemas';
import {
  ActivoCatalogo,
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  Organizacion,
  PostInventarioResponse,
} from './qr-connector.types';
import { SEED_CATALOGO, SEED_ORGANIZACIONES } from './qr-connector.seed';

const MOCK_TOKEN_TTL_MS = 15 * 60 * 1000;

interface InventarioRegistro {
  inventarioId: string;
  requestHash: string;
  response: PostInventarioResponse;
  ultimoIntento: string;
}

@Injectable()
export class QrConnectorService {
  // Mock en memoria — se pierde al reiniciar el proceso. No es la implementacion real (esa
  // vive en CORE/Base Patrimonial), solo desbloquea el desarrollo de APP QR/CIS mientras las
  // 4 preguntas abiertas a SICSAFT CORE (DOC-002 §3/§6) siguen sin respuesta.
  private readonly inventariosPorIdempotencyKey = new Map<
    string,
    InventarioRegistro
  >();
  private readonly inventariosPorId = new Map<string, InventarioRegistro>();

  authSession(request: AuthSessionRequest): AuthSessionResponse {
    // TODO(TASK-007 / ADR-002): reemplazar por validacion real contra Zitadel + vigencia de
    // contrato por sede — hoy el mock no verifica `credencial` ni `deviceId`, solo los exige
    // presentes (ver qr-connector.schemas.ts).
    void request;

    return {
      accessToken: `mock-token-${randomUUID()}`,
      expiresAt: new Date(Date.now() + MOCK_TOKEN_TTL_MS).toISOString(),
      organizaciones: SEED_ORGANIZACIONES as Organizacion[],
    };
  }

  getCatalogo(query: CatalogoQuery): CatalogoResponse {
    const activos: ActivoCatalogo[] = SEED_CATALOGO.filter(
      (activo) =>
        activo.organizacionId === query.organizacionId &&
        (query.areaId === undefined || activo.areaId === query.areaId) &&
        (query.ubicacionId === undefined ||
          activo.ubicacionId === query.ubicacionId),
    );

    return { activos };
  }

  postInventario(request: InventarioRequest): PostInventarioResponse {
    const organizacionExiste = SEED_ORGANIZACIONES.some(
      (org) => org.id === request.organizacionId,
    );
    if (!organizacionExiste) {
      throw new BadRequestException({
        message: 'Rechazado: organización inexistente',
        errores: [
          {
            campo: 'organizacionId',
            detalle: `No existe la organización '${request.organizacionId}'`,
          },
        ],
      });
    }

    const requestHash = this.hashRequest(request);
    const existente = this.inventariosPorIdempotencyKey.get(
      request.idempotencyKey,
    );

    if (existente) {
      if (existente.requestHash !== requestHash) {
        // DOC-002 §5: idempotencyKey reutilizada con payload distinto es bug de cliente, no se
        // reintenta automaticamente.
        throw new ConflictException({
          message: 'idempotencyKey ya usada con un payload distinto',
          correlationId: request.correlationId,
        });
      }
      // Mismo payload, misma key: reintento legitimo — se devuelve el resultado ya procesado,
      // nunca se duplica el inventario (DOC-002 §4).
      return existente.response;
    }

    const registro: InventarioRegistro = {
      inventarioId: randomUUID(),
      requestHash,
      response: { inventarioId: '', estado: 'recibido' },
      ultimoIntento: new Date().toISOString(),
    };
    registro.response = {
      inventarioId: registro.inventarioId,
      estado: 'recibido',
    };

    this.inventariosPorIdempotencyKey.set(request.idempotencyKey, registro);
    this.inventariosPorId.set(registro.inventarioId, registro);

    return registro.response;
  }

  getInventarioEstado(inventarioId: string): InventarioEstadoResponse {
    const registro = this.inventariosPorId.get(inventarioId);
    if (!registro) {
      throw new NotFoundException({
        message: `No existe el inventario '${inventarioId}'`,
      });
    }

    return {
      estado: registro.response.estado,
      ultimoIntento: registro.ultimoIntento,
    };
  }

  private hashRequest(request: InventarioRequest): string {
    return createHash('sha256').update(JSON.stringify(request)).digest('hex');
  }
}
