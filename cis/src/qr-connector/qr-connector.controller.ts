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
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
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
// ve una credencial. Los 4 endpoints son proxy hacia CORE (DOC-006, Fase 3): `organizaciones` en
// auth/session viene de GET /entitlements, y catalogo/inventarios de GET /catalogo,
// POST /inventarios y GET /inventarios/:id/estado — ya no hay mock ni estado propio en CIS.
// RateLimitGuard corre despues de ZitadelAuthGuard (el orden en @UseGuards importa: necesita
// `request.auth` ya seteado) — WAF §4 "rate limiting hacia el CORE" por operador.
@Controller()
@UseGuards(ZitadelAuthGuard, RateLimitGuard)
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
  getCatalogo(
    @Query() query: CatalogoQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<CatalogoResponse> {
    return this.qrConnectorService.getCatalogo(query, request.correlationId);
  }

  @Post('inventarios')
  @UsePipes(new ZodValidationPipe(inventarioRequestSchema))
  postInventario(
    @Body() body: InventarioRequest,
    @Req() request: RequestWithCorrelationId,
  ): Promise<PostInventarioResponse> {
    return this.qrConnectorService.postInventario(body, request.correlationId);
  }

  @Get('inventarios/:inventarioId/estado')
  getInventarioEstado(
    @Param('inventarioId') inventarioId: string,
    @Req() request: RequestWithCorrelationId,
  ): Promise<InventarioEstadoResponse> {
    return this.qrConnectorService.getInventarioEstado(
      inventarioId,
      request.correlationId,
    );
  }
}
