import { Module } from '@nestjs/common';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresRepository } from './indicadores.repository';

// DOC-021 4 (Administrador del Sistema) — modulo nuevo, sin dependencia de OrquestadorService
// (solo lectura, sin auditoria) a diferencia del resto de modulos de este incremento.
@Module({
  controllers: [IndicadoresController],
  providers: [IndicadoresRepository],
})
export class IndicadoresModule {}
