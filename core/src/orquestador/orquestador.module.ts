import { Module } from '@nestjs/common';
import { InventariosModule } from '../inventarios/inventarios.module';
import { PatrimonialModule } from '../patrimonial/patrimonial.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { InventariosController } from '../inventarios/inventarios.controller';
import { ActivoEscrituraController } from '../patrimonial/activo-escritura.controller';
import { OrquestadorService } from './orquestador.service';

// DOC-007 — aloja InventariosController y ActivoEscrituraController acá (no en sus modulos de
// dominio) para evitar el ciclo <Modulo> -> OrquestadorModule -> <Modulo>: ambos controllers
// necesitan OrquestadorService, que a su vez necesita InventariosService/EscrituraActivoService.
@Module({
  imports: [InventariosModule, PatrimonialModule, AuditoriaModule],
  controllers: [InventariosController, ActivoEscrituraController],
  providers: [OrquestadorService],
})
export class OrquestadorModule {}
