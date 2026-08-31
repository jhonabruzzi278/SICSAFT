import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module';
import { EstructuraModule } from '../estructura/estructura.module';
import { CatalogoController } from './catalogo.controller';
import { ActivoRepository } from './activo.repository';
import { EscrituraActivoService } from './escritura-activo.service';
import { ImportacionContableService } from './importacion-contable.service';
import { ImportacionContableLoteService } from './importacion-contable-lote.service';
import { ImportacionContableLoteRepository } from './importacion-contable-lote.repository';
import { ResolvedorImportacionService } from './resolvedor-importacion.service';
import { CatalogoTipoActivoController } from './catalogo-tipo-activo.controller';
import { CatalogoTipoActivoRepository } from './catalogo-tipo-activo.repository';
import { DocumentoActivoRepository } from './documento-activo.repository';
import { EscrituraDocumentoActivoService } from './escritura-documento-activo.service';

// DOC-008 (Motor Patrimonial, lectura) + DOC-012 5/6 (escritura oficial de Activo e importacion
// masiva, Fase 4) + DOC-021 3/4 (descripcion/documentos/catalogo-tipos, gaps del CCP) —
// ActivoEscrituraController/ImportacionContableController/CatalogoTipoActivoEscrituraController/
// DocumentoActivoController viven en OrquestadorModule, no acá (mismo motivo que
// InventariosController: evita el ciclo con OrquestadorService). Sin controller de traslado en
// esta fase — sin consumidor real todavia (ver DOC-008 "Traslado y cambio de ubicacion/estado").
@Module({
  imports: [EventosModule, EstructuraModule],
  controllers: [CatalogoController, CatalogoTipoActivoController],
  providers: [
    ActivoRepository,
    EscrituraActivoService,
    ImportacionContableService,
    ImportacionContableLoteService,
    ImportacionContableLoteRepository,
    ResolvedorImportacionService,
    CatalogoTipoActivoRepository,
    DocumentoActivoRepository,
    EscrituraDocumentoActivoService,
  ],
  exports: [
    ActivoRepository,
    EscrituraActivoService,
    ImportacionContableService,
    ImportacionContableLoteService,
    ImportacionContableLoteRepository,
    ResolvedorImportacionService,
    CatalogoTipoActivoRepository,
    DocumentoActivoRepository,
    EscrituraDocumentoActivoService,
  ],
})
export class PatrimonialModule {}
