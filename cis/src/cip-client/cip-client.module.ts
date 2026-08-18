import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { loadCipClientConfig } from './cip-client.config';
import { CIP_CIRCUIT_BREAKER, CIP_CLIENT_CONFIG } from './cip-client.constants';
import { CipClientService } from './cip-client.service';
import { CircuitBreaker } from '../core-client/circuit-breaker';

// Mismos parámetros que CoreClientModule (5 fallos consecutivos, 30s de reset) — un solo breaker
// compartido por las 8 llamadas de lectura del dashboard, mismo criterio WAF §4.
@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: CIP_CLIENT_CONFIG,
      useFactory: loadCipClientConfig,
    },
    {
      provide: CIP_CIRCUIT_BREAKER,
      useFactory: () =>
        new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 }),
    },
    CipClientService,
  ],
  exports: [CipClientService],
})
export class CipClientModule {}
