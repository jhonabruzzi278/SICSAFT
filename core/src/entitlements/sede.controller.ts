import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SedeRepository } from './sede.repository';
import { sedesQuerySchema } from './sede.schemas';
import type { SedesQuery } from './sede.schemas';
import type { Sede } from './sede.types';

// DOC-024 1 — hasta este incremento Sede no tenia controller de lectura propio (se leia via JOIN
// dentro de ContratoRepository, ver comentario en entitlements.module.ts) — hace falta uno real
// para que `web_admin` pueda listar las sedes de una organizacion y ofrecer un picker en vez de
// que el operador copie/pegue un id a mano. Lectura abierta (mismo criterio que
// OrganizacionController/ContratoController): vive en EntitlementsModule, no en OrquestadorModule
// (no necesita OrquestadorService).
@Controller()
@UseGuards(ServiceTokenGuard)
export class SedeController {
  constructor(private readonly sedeRepository: SedeRepository) {}

  @Get('sedes')
  listar(
    @Query(new ZodValidationPipe(sedesQuerySchema)) query: SedesQuery,
  ): Promise<Sede[]> {
    return this.sedeRepository.listarPorOrganizacion(query.organizacionId);
  }
}
