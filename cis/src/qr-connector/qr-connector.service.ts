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
  ResumenControl,
  SesionDetalle,
  SesionResumen,
} from './qr-connector.types';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import { CoreClientService } from '../core-client/core-client.service';
import { DeviceRegistryService } from '../device-registry/device-registry.service';

// Piso del TTL de registro de dispositivo — evita programar un timeout <= 0 en el caso limite
// de que el token ya este por expirar en el instante exacto en que se procesa la request
// (KeycloakAuthGuard ya valido que no este vencido, pero el margen puede ser de milisegundos).
const MIN_DEVICE_TTL_MS = 1_000;

@Injectable()
export class QrConnectorService {
  constructor(
    private readonly coreClientService: CoreClientService,
    private readonly deviceRegistryService: DeviceRegistryService,
  ) {}

  async authSession(
    request: AuthSessionRequest,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<AuthSessionResponse> {
    // KeycloakAuthGuard ya validó el token — el operador viene autenticado por Keycloak, no por
    // este metodo. `accessToken`/`expiresAt` son pass-through del mismo token (ver ADR-004: el
    // CIS valida, no emite uno propio).
    // DOC-002 1 "un solo dispositivo por operador": el dispositivo de esta request pasa a ser
    // el activo (supersede al anterior, ver DeviceRegistryService) — el registro expira solo
    // junto con el token, sin requerir logout explicito.
    const ttlMs = Math.max(
      new Date(auth.expiresAt).getTime() - Date.now(),
      MIN_DEVICE_TTL_MS,
    );
    this.deviceRegistryService.registerDevice(
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

  // DOC-006 2 (Fase 3): CIS es un proxy delgado — sin filtrado ni logica propia, CORE ya
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

  // DOC-006 3 (Fase 3): idempotencia, clasificacion de escaneos y validacion de
  // organizacion/area/ubicacion viven en CORE (sesiones_inventario, Motor de Reglas) — CIS ya no
  // mantiene su propio estado en memoria. Los 400/409 que DOC-002 5 exige distinguir de un 502
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

  // RF-04 (Fase 5, WEB) — proxy delgado, mismo criterio que getCatalogo.
  async getInventarios(
    organizacionId: string,
    correlationId: string,
  ): Promise<SesionResumen[]> {
    return this.coreClientService.getInventarios(organizacionId, correlationId);
  }

  async getInventarioDetalle(
    inventarioId: string,
    correlationId: string,
  ): Promise<SesionDetalle> {
    return this.coreClientService.getInventarioDetalle(
      inventarioId,
      correlationId,
    );
  }

  // DOC-029 RF-I — informe de control de área ("Pantalla 8"). Proxy delgado, mismo criterio que
  // getInventarioDetalle: CIS no transforma el contrato de CORE.
  async getInventarioResumenControl(
    inventarioId: string,
    correlationId: string,
  ): Promise<ResumenControl> {
    return this.coreClientService.getInventarioResumenControl(
      inventarioId,
      correlationId,
    );
  }
}
