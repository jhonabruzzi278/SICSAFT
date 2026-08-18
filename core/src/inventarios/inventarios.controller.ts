import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
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
  inventarioDetalleParamsSchema,
  inventarioEstadoParamsSchema,
  inventariosQuerySchema,
  inventarioRequestSchema,
} from './inventarios.schemas';
import type {
  InventarioDetalleParams,
  InventarioEstadoParams,
  InventarioRequestBody,
  InventariosQuery,
} from './inventarios.schemas';
import type {
  InventarioEstadoResponse,
  PostInventarioResponse,
  SesionDetalle,
  SesionResumen,
} from './inventarios.types';

// DOC-006 3/4. POST pasa por el Orquestador (DOC-007, audita siempre) — GET es solo lectura,
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

  // RF-04 (Fase 5, WEB) — listado y detalle de sesiones. Pipe a nivel de parámetro (no
  // @UsePipes de método): `getInventarioDetalle` combina @Param con @Query en potencia futura y
  // ya se probó en DOC-012 5 (Fase 5) que @UsePipes de método valida TODOS los parámetros del
  // handler, rompiendo con cualquier @Param que no sea el body.
  @Get('inventarios')
  getInventarios(
    @Query(new ZodValidationPipe(inventariosQuerySchema))
    query: InventariosQuery,
  ): Promise<SesionResumen[]> {
    return this.inventariosService.listarSesiones(query.organizacionId);
  }

  @Get('inventarios/:id')
  getInventarioDetalle(
    @Param(new ZodValidationPipe(inventarioDetalleParamsSchema))
    params: InventarioDetalleParams,
  ): Promise<SesionDetalle> {
    return this.inventariosService.obtenerDetalle(params.id);
  }
}
