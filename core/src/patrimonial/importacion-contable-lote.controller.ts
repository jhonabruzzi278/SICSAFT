import {
  BadRequestException,
  Body,
  Controller,
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
import {
  aprobarLoteSchema,
  crearLoteSchema,
  rechazarLoteSchema,
} from './importacion-contable-lote.schemas';
import type {
  AprobarLoteBody,
  CrearLoteBody,
  RechazarLoteBody,
} from './importacion-contable-lote.schemas';
import type { ImportacionContableResultado } from './importacion-contable.types';
import type {
  EstadoLote,
  LoteConFilas,
  LoteImportacionContable,
} from './importacion-contable-lote.types';

const ESTADOS_LOTE: readonly EstadoLote[] = [
  'pendiente_revision',
  'aprobado',
  'rechazado',
];

// DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada. Mismo criterio que
// ImportacionContableController: solo ServiceTokenGuard acá, la autorización de rol de las
// escrituras (crear/aprobar/rechazar) se resuelve dentro de OrquestadorService para que un 403
// quede auditado (DOC-012 8). Las lecturas (listar/obtener) confían en el service token: CIS ya
// validó la sesión humana y acota `organizacionId`.
@Controller('importaciones')
@UseGuards(ServiceTokenGuard)
export class ImportacionContableLoteController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post('contable/lote')
  @HttpCode(HttpStatus.OK)
  crearLote(
    @Body(new ZodValidationPipe(crearLoteSchema)) body: CrearLoteBody,
  ): Promise<{ loteId: string }> {
    return this.orquestadorService.crearLoteImportacionContable(body);
  }

  @Get('contable/lote')
  listarLotes(
    @Query('organizacionId') organizacionId?: string,
    @Query('estado') estado?: string,
  ): Promise<LoteImportacionContable[]> {
    if (!organizacionId) {
      throw new BadRequestException('Falta el parámetro organizacionId.');
    }
    if (estado !== undefined && !ESTADOS_LOTE.includes(estado as EstadoLote)) {
      throw new BadRequestException(
        `estado inválido: '${estado}'. Válidos: ${ESTADOS_LOTE.join(', ')}.`,
      );
    }
    return this.orquestadorService.listarLotesImportacionContable(
      organizacionId,
      estado as EstadoLote | undefined,
    );
  }

  @Get('contable/lote/:id')
  obtenerLote(@Param('id') id: string): Promise<LoteConFilas> {
    return this.orquestadorService.obtenerLoteImportacionContable(id);
  }

  @Post('contable/lote/:id/aprobar')
  @HttpCode(HttpStatus.OK)
  aprobarLote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(aprobarLoteSchema)) body: AprobarLoteBody,
  ): Promise<ImportacionContableResultado> {
    return this.orquestadorService.aprobarLoteImportacionContable(id, body);
  }

  @Post('contable/lote/:id/rechazar')
  @HttpCode(HttpStatus.OK)
  rechazarLote(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rechazarLoteSchema)) body: RechazarLoteBody,
  ): Promise<{ estado: 'rechazado' }> {
    return this.orquestadorService.rechazarLoteImportacionContable(id, body);
  }
}
