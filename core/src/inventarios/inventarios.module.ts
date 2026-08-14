import { Module } from '@nestjs/common';
import { PatrimonialModule } from '../patrimonial/patrimonial.module';
import { EventosModule } from '../eventos/eventos.module';
import { InventariosService } from './inventarios.service';
import { SesionInventarioRepository } from './sesion-inventario.repository';

// Sin controller propio: InventariosController vive en OrquestadorModule (DOC-007) para evitar
// una dependencia circular (el controller necesita OrquestadorService, que a su vez necesita
// InventariosService de este modulo).
@Module({
  imports: [PatrimonialModule, EventosModule],
  providers: [InventariosService, SesionInventarioRepository],
  exports: [InventariosService],
})
export class InventariosModule {}
