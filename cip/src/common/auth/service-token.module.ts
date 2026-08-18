import { Global, Module } from '@nestjs/common';
import { loadServiceTokenConfig } from './service-token.config';
import { SERVICE_TOKEN_CONFIG } from './service-token.constants';
import { ServiceTokenGuard } from './service-token.guard';

// Global: mismo patron que core/src/common/auth/service-token.module.ts.
@Global()
@Module({
  providers: [
    {
      provide: SERVICE_TOKEN_CONFIG,
      useFactory: loadServiceTokenConfig,
    },
    ServiceTokenGuard,
  ],
  exports: [SERVICE_TOKEN_CONFIG, ServiceTokenGuard],
})
export class ServiceTokenModule {}
