import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { InventariosService } from './inventarios.service';
import {
  inventarioEstadoParamsSchema,
  inventarioRequestSchema,
} from './inventarios.schemas';
import type {
  InventarioEstadoParams,
  InventarioRequestBody,
} from './inventarios.schemas';
import type {
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './inventarios.types';

// DOC-006 §3/§4. POST pasa por el Orquestador (DOC-007, audita siempre) — GET es solo lectura,
// no necesita orquestacion ni auditoria (el propio DOC-007 lo deja explicito: un unico metodo
// publico, procesarInventario).
@Controller()
@UseGuards(ServiceTokenGuard)
export class InventariosController {
  constructor(
    private readonly orquestadorService: OrquestadorService,
    private readonly inventariosService: InventariosService,
  ) {}

  @Post('inventarios')
  @UsePipes(new ZodValidationPipe(inventarioRequestSchema))
  postInventario(
    @Body() body: InventarioRequestBody,
    @Req() request: RequestWithCorrelationId,
  ): Promise<PostInventarioResponse> {
    return this.orquestadorService.procesarInventario(
      body,
      request.correlationId,
    );
  }

  @Get('inventarios/:inventarioId/estado')
  @UsePipes(new ZodValidationPipe(inventarioEstadoParamsSchema))
  getInventarioEstado(
    @Param() params: InventarioEstadoParams,
  ): Promise<InventarioEstadoResponse> {
    return this.inventariosService.obtenerEstado(params.inventarioId);
  }
}
