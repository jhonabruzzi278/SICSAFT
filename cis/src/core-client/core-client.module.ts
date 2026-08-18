import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { loadCoreClientConfig } from './core-client.config';
import {
  CORE_CIRCUIT_BREAKER,
  CORE_CLIENT_CONFIG,
} from './core-client.constants';
import { CoreClientService } from './core-client.service';
import { CircuitBreaker } from './circuit-breaker';

// Un solo CircuitBreaker compartido por las 4 llamadas a CORE (entitlements/catalogo/
// inventarios/estado) — si CORE esta caido, todas dejan de insistir juntas, no cada una por
// separado (WAF 4). Parametros conservadores para el tamaño de trafico actual: 5 fallos
// consecutivos antes de abrir, 30s antes de sondear de nuevo.
@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: CORE_CLIENT_CONFIG,
      useFactory: loadCoreClientConfig,
    },
    {
      provide: CORE_CIRCUIT_BREAKER,
      useFactory: () =>
        new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 }),
    },
    CoreClientService,
  ],
  exports: [CoreClientService],
})
export class CoreClientModule {}
