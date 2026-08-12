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
  PostInventarioResponse,
} from './qr-connector.types';
import { SEED_CATALOGO, SEED_ORGANIZACIONES } from './qr-connector.seed';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import { CoreClientService } from '../core-client/core-client.service';

interface InventarioRegistro {
  inventarioId: string;
  requestHash: string;
  response: PostInventarioResponse;
  ultimoIntento: string;
}

@Injectable()
export class QrConnectorService {
  constructor(private readonly coreClientService: CoreClientService) {}

  // Mock en memoria — se pierde al reiniciar el proceso. `organizaciones` ya no es mock (viene
  // de CORE, ver authSession); esto sigue siendo mock para inventarios/catalogo mientras el
  // resto del dominio patrimonial (DOC-005) no exista.
  private readonly inventariosPorIdempotencyKey = new Map<
    string,
    InventarioRegistro
  >();
  private readonly inventariosPorId = new Map<string, InventarioRegistro>();

  async authSession(
    request: AuthSessionRequest,
    auth: ZitadelAuthContext,
  ): Promise<AuthSessionResponse> {
    // ZitadelAuthGuard ya validó el token — el operador viene autenticado por Zitadel, no por
    // este metodo. `accessToken`/`expiresAt` son pass-through del mismo token (ver ADR-002: el
    // CIS valida, no emite uno propio).
    // `deviceId` no se enforced todavia (un solo dispositivo por operador, DOC-002 §1) —
    // requiere persistencia que hoy no existe.
    void request.deviceId;

    const { organizaciones } = await this.coreClientService.getEntitlements(
      auth.operadorId,
    );

    return {
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
      organizaciones,
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
