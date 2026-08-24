import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditoriaRepository } from './auditoria.repository';
import { registrarAuditoriaSchema } from './auditoria.schemas';
import type { RegistrarAuditoriaBody } from './auditoria.schemas';

// DOC-024 3 — a diferencia de cada otro `*-escritura.controller.ts` de este ecosistema, este NO
// vive en OrquestadorModule: no hay ningun rol que verificar acá (la autorizacion ya se resolvio
// en el guard de CIS que dejo pasar la operacion de identidad que se esta reportando), solo
// ServiceTokenGuard. Vive en AuditoriaModule, junto al AuditoriaController de lectura. No
// "corregir" esto para que quede junto a los demas — es la unica escritura de este incremento que
// no pasa por OrquestadorService a proposito.
//
// `categoria` se fuerza a 'identidad' server-side: ningun llamador puede reportarse a si mismo
// como 'patrimonial' (esa categoria es exclusiva de OrquestadorService.ejecutarOperacionOficial).
@Controller('auditoria')
@UseGuards(ServiceTokenGuard)
export class AuditoriaEscrituraController {
  constructor(private readonly auditoriaRepository: AuditoriaRepository) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  registrar(
    @Body(new ZodValidationPipe(registrarAuditoriaSchema))
    body: RegistrarAuditoriaBody,
  ): Promise<void> {
    return this.auditoriaRepository.registrar({
      ...body,
      categoria: 'identidad',
    });
  }
}
