import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { QrConnectorService } from './qr-connector.service';
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

// Implementa el contrato MOCK de DOC-002 (app-qr-sicsaft/aidlc-docs/design-artifacts/DOC-002-conector-qr.md).
@Controller()
export class QrConnectorController {
  constructor(private readonly qrConnectorService: QrConnectorService) {}

  @Post('auth/session')
  @UsePipes(new ZodValidationPipe(authSessionRequestSchema))
  authSession(@Body() body: AuthSessionRequest): AuthSessionResponse {
    return this.qrConnectorService.authSession(body);
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
