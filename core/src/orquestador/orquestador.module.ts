import { Module } from '@nestjs/common';
import { InventariosModule } from '../inventarios/inventarios.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { InventariosController } from '../inventarios/inventarios.controller';
import { OrquestadorService } from './orquestador.service';

// DOC-007 — aloja InventariosController acá (no en InventariosModule) para evitar el ciclo
// InventariosModule -> OrquestadorModule -> InventariosModule: el controller necesita
// OrquestadorService, que a su vez necesita InventariosService.
@Module({
  imports: [InventariosModule, AuditoriaModule],
  controllers: [InventariosController],
  providers: [OrquestadorService],
})
export class OrquestadorModule {}
