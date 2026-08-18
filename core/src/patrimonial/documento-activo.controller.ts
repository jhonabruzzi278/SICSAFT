import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { DocumentoActivoRepository } from './documento-activo.repository';
import {
  altaDocumentoActivoSchema,
  documentosActivoQuerySchema,
  eliminarDocumentoActivoSchema,
} from './documento-activo.schemas';
import type {
  AltaDocumentoActivoBody,
  DocumentosActivoQuery,
  EliminarDocumentoActivoBody,
} from './documento-activo.schemas';
import type { DocumentoActivo } from './documento-activo.types';

// DOC-021 3 — vive en OrquestadorModule (no en PatrimonialModule) porque POST/DELETE necesitan
// OrquestadorService para auditoria+rol (mismo motivo que ActivoEscrituraController). GET no
// necesita orquestacion (lectura abierta, mismo criterio que CatalogoTipoActivoController) pero
// vive acá igual — las 3 rutas comparten el mismo path anidado `/activos/:id/documentos`, separar
// el GET a otro archivo solo por eso no aporta claridad.
@Controller('activos/:activoId/documentos')
@UseGuards(ServiceTokenGuard)
export class DocumentoActivoController {
  constructor(
    private readonly orquestadorService: OrquestadorService,
    private readonly documentoActivoRepository: DocumentoActivoRepository,
  ) {}

  @Get()
  listar(
    @Param('activoId') activoId: string,
    @Query(new ZodValidationPipe(documentosActivoQuerySchema))
    query: DocumentosActivoQuery,
  ): Promise<DocumentoActivo[]> {
    return this.documentoActivoRepository.listarPorActivo(
      activoId,
      query.organizacionId,
    );
  }

  @Post()
  crear(
    @Param('activoId') activoId: string,
    @Body(new ZodValidationPipe(altaDocumentoActivoSchema))
    body: AltaDocumentoActivoBody,
  ): Promise<DocumentoActivo> {
    return this.orquestadorService.procesarAltaDocumentoActivo(activoId, body);
  }

  @Delete(':documentoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('activoId') activoId: string,
    @Param('documentoId') documentoId: string,
    @Body(new ZodValidationPipe(eliminarDocumentoActivoSchema))
    body: EliminarDocumentoActivoBody,
  ): Promise<void> {
    return this.orquestadorService.procesarEliminarDocumentoActivo(
      activoId,
      documentoId,
      body,
    );
  }
}
