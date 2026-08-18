import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { CatalogoTipoActivoRepository } from './catalogo-tipo-activo.repository';
import type { CatalogoTipoActivo } from './catalogo-tipo-activo.types';

// DOC-021 4 — lectura abierta a cualquier caller autenticado como CIS, mismo criterio que
// CatalogoController/ContratoController (Tomo III 1.4 ya le concede lectura a toda entrada
// oficial). El alta (POST /catalogo-tipos) vive en OrquestadorModule — necesita auditoria+rol.
@Controller()
@UseGuards(ServiceTokenGuard)
export class CatalogoTipoActivoController {
  constructor(
    private readonly catalogoTipoActivoRepository: CatalogoTipoActivoRepository,
  ) {}

  @Get('catalogo-tipos')
  listar(): Promise<CatalogoTipoActivo[]> {
    return this.catalogoTipoActivoRepository.listar();
  }
}
