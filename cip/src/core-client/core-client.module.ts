import { Module } from '@nestjs/common';
import { CORE_CLIENT_CONFIG } from './core-client.constants';
import { loadCoreClientConfig } from './core-client.config';
import { CoreClientService } from './core-client.service';

@Module({
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
