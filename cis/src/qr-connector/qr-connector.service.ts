import { Injectable } from '@nestjs/common';
import {
  AuthSessionRequest,
  CatalogoQuery,
  InventarioRequest,
} from './qr-connector.schemas';
import {
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './qr-connector.types';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import { CoreClientService } from '../core-client/core-client.service';

@Injectable()
export class QrConnectorService {
  constructor(private readonly coreClientService: CoreClientService) {}

  async authSession(
    request: AuthSessionRequest,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<AuthSessionResponse> {
    // ZitadelAuthGuard ya validó el token — el operador viene autenticado por Zitadel, no por
    // este metodo. `accessToken`/`expiresAt` son pass-through del mismo token (ver ADR-002: el
    // CIS valida, no emite uno propio).
    // `request.deviceId` no se enforced todavia (un solo dispositivo por operador, DOC-002 §1)
    // — requiere persistencia que hoy no existe.

    const { organizaciones } = await this.coreClientService.getEntitlements(
      auth.operadorId,
      correlationId,
    );

    return {
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
      organizaciones,
    };
  }

  // DOC-006 §2 (Fase 3): CIS es un proxy delgado — sin filtrado ni logica propia, CORE ya
  // resuelve la query completa contra la Base Patrimonial real.
  async getCatalogo(
    query: CatalogoQuery,
    correlationId: string,
  ): Promise<CatalogoResponse> {
    const { activos } = await this.coreClientService.getCatalogo(
      query,
      correlationId,
    );
    return { activos };
  }

  // DOC-006 §3 (Fase 3): idempotencia, clasificacion de escaneos y validacion de
  // organizacion/area/ubicacion viven en CORE (sesiones_inventario, Motor de Reglas) — CIS ya no
  // mantiene su propio estado en memoria. Los 400/409 que DOC-002 §5 exige distinguir de un 502
  // ya vienen resueltos por CoreClientService.callCore (passthroughStatuses).
  async postInventario(
    request: InventarioRequest,
    correlationId: string,
  ): Promise<PostInventarioResponse> {
    return this.coreClientService.postInventario(request, correlationId);
  }

  async getInventarioEstado(
    inventarioId: string,
    correlationId: string,
  ): Promise<InventarioEstadoResponse> {
    return this.coreClientService.getInventarioEstado(
      inventarioId,
      correlationId,
    );
  }
}
