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
import { DeviceRegistryService } from '../device-registry/device-registry.service';

// Piso del TTL de registro de dispositivo — evita mandarle a Redis un PX <= 0 en el caso limite
// de que el token ya este por expirar en el instante exacto en que se procesa la request
// (ZitadelAuthGuard ya valido que no este vencido, pero el margen puede ser de milisegundos).
const MIN_DEVICE_TTL_MS = 1_000;

@Injectable()
export class QrConnectorService {
  constructor(
    private readonly coreClientService: CoreClientService,
    private readonly deviceRegistryService: DeviceRegistryService,
  ) {}

  async authSession(
    request: AuthSessionRequest,
    auth: ZitadelAuthContext,
    correlationId: string,
  ): Promise<AuthSessionResponse> {
    // ZitadelAuthGuard ya validó el token — el operador viene autenticado por Zitadel, no por
    // este metodo. `accessToken`/`expiresAt` son pass-through del mismo token (ver ADR-002: el
    // CIS valida, no emite uno propio).
    // DOC-002 §1 "un solo dispositivo por operador": el dispositivo de esta request pasa a ser
    // el activo (supersede al anterior, ver DeviceRegistryService) — el registro expira solo
    // junto con el token, sin requerir logout explicito.
    const ttlMs = Math.max(
      new Date(auth.expiresAt).getTime() - Date.now(),
      MIN_DEVICE_TTL_MS,
    );
    await this.deviceRegistryService.registerDevice(
      auth.operadorId,
      request.deviceId,
      ttlMs,
    );

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
