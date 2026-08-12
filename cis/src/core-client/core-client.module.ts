import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { loadCoreClientConfig } from './core-client.config';
import { CORE_CLIENT_CONFIG } from './core-client.constants';
import { CoreClientService } from './core-client.service';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: CORE_CLIENT_CONFIG,
      useFactory: loadCoreClientConfig,
    },
    CoreClientService,
  ],
  exports: [CoreClientService],
})
export class CoreClientModule {}
