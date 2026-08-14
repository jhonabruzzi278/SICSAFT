import { Module } from '@nestjs/common';
import { InventariosModule } from '../inventarios/inventarios.module';
import { PatrimonialModule } from '../patrimonial/patrimonial.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { InventariosController } from '../inventarios/inventarios.controller';
import { ActivoEscrituraController } from '../patrimonial/activo-escritura.controller';
import { ImportacionContableController } from '../patrimonial/importacion-contable.controller';
import { ContratoEscrituraController } from '../entitlements/contrato-escritura.controller';
import { OrquestadorService } from './orquestador.service';

// DOC-007 — aloja acá todos los controllers de escritura oficial (no en sus modulos de dominio)
// para evitar el ciclo <Modulo> -> OrquestadorModule -> <Modulo>: todos necesitan
// OrquestadorService, que a su vez necesita sus respectivos servicios de escritura.
@Module({
  imports: [
    InventariosModule,
    PatrimonialModule,
    EntitlementsModule,
    AuditoriaModule,
  ],
  controllers: [
    InventariosController,
    ActivoEscrituraController,
    ImportacionContableController,
    ContratoEscrituraController,
  ],
  providers: [OrquestadorService],
})
export class OrquestadorModule {}
