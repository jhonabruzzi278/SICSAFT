import { Module } from '@nestjs/common';
import { InventariosModule } from '../inventarios/inventarios.module';
import { PatrimonialModule } from '../patrimonial/patrimonial.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EstructuraModule } from '../estructura/estructura.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { InventariosController } from '../inventarios/inventarios.controller';
import { ActivoEscrituraController } from '../patrimonial/activo-escritura.controller';
import { ImportacionContableController } from '../patrimonial/importacion-contable.controller';
import { ImportacionContableLoteController } from '../patrimonial/importacion-contable-lote.controller';
import { EstructuraEscrituraController } from '../estructura/estructura-escritura.controller';
import { CatalogoTipoActivoEscrituraController } from '../patrimonial/catalogo-tipo-activo-escritura.controller';
import { DocumentoActivoController } from '../patrimonial/documento-activo.controller';
import { OrquestadorService } from './orquestador.service';

// DOC-007 — aloja acá todos los controllers de escritura oficial (no en sus modulos de dominio)
// para evitar el ciclo <Modulo> -> OrquestadorModule -> <Modulo>: todos necesitan
// OrquestadorService, que a su vez necesita sus respectivos servicios de escritura.
@Module({
  imports: [
    InventariosModule,
    PatrimonialModule,
    EntitlementsModule,
    EstructuraModule,
    AuditoriaModule,
  ],
  controllers: [
    InventariosController,
    ActivoEscrituraController,
    ImportacionContableController,
    ImportacionContableLoteController,
    EstructuraEscrituraController,
    CatalogoTipoActivoEscrituraController,
    DocumentoActivoController,
  ],
  providers: [OrquestadorService],
})
export class OrquestadorModule {}
