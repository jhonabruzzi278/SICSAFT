import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  ZitadelAuthGuard,
  requireAuthContext,
  type AuthenticatedRequest,
} from '../common/auth/zitadel-auth.guard';
import { QrConnectorService } from './qr-connector.service';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import {
  authSessionRequestSchema,
  catalogoQuerySchema,
  inventarioRequestSchema,
} from './qr-connector.schemas';
import type {
  AuthSessionRequest,
  CatalogoQuery,
  InventarioRequest,
} from './qr-connector.schemas';
import type {
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './qr-connector.types';

// Implementa el contrato de DOC-002 (app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md).
// Autenticacion real via Zitadel (ADR-002): ZitadelAuthGuard valida el access token OIDC en
// todas las rutas — el operador ya se autenticó contra Zitadel antes de llegar acá, el CIS nunca
// ve una credencial. `organizaciones` en auth/session viene de CORE (GET /entitlements, ver
// DOC-004 §6), ya no es mock. catalogo/inventarios siguen siendo mock — el resto del dominio
// patrimonial (DOC-005) todavia no existe.
@Controller()
@UseGuards(ZitadelAuthGuard)
export class QrConnectorController {
  constructor(private readonly qrConnectorService: QrConnectorService) {}

  @Post('auth/session')
  @UsePipes(new ZodValidationPipe(authSessionRequestSchema))
  authSession(
    @Body() body: AuthSessionRequest,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<AuthSessionResponse> {
    return this.qrConnectorService.authSession(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Get('catalogo')
  @UsePipes(new ZodValidationPipe(catalogoQuerySchema))
  getCatalogo(@Query() query: CatalogoQuery): CatalogoResponse {
    return this.qrConnectorService.getCatalogo(query);
  }

  @Post('inventarios')
  @UsePipes(new ZodValidationPipe(inventarioRequestSchema))
  postInventario(@Body() body: InventarioRequest): PostInventarioResponse {
    return this.qrConnectorService.postInventario(body);
  }

  @Get('inventarios/:inventarioId/estado')
  getInventarioEstado(
    @Param('inventarioId') inventarioId: string,
  ): InventarioEstadoResponse {
    return this.qrConnectorService.getInventarioEstado(inventarioId);
  }
}
