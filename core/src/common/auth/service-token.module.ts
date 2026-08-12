import { Global, Module } from '@nestjs/common';
import { loadServiceTokenConfig } from './service-token.config';
import { SERVICE_TOKEN_CONFIG } from './service-token.constants';
import { ServiceTokenGuard } from './service-token.guard';

// Global: cualquier controller interno de CORE (hoy solo EntitlementsController, mañana los
// motores) necesita este guard sin tener que reimportar el modulo cada vez.
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
