import { Module } from '@nestjs/common';
import { CoreClientModule } from '../core-client/core-client.module';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';
import { ORGANIZACION_MAPPING } from './administrador.constants';
import { loadOrganizacionMapping } from './organizacion-mapping.config';

@Module({
  imports: [CoreClientModule],
  controllers: [AdministradorController],
  providers: [
    AdministradorService,
    { provide: ORGANIZACION_MAPPING, useFactory: loadOrganizacionMapping },
  ],
})
export class AdministradorModule {}
