import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { loadZitadelAdminConfig } from './zitadel-admin.config';
import {
  ZITADEL_ADMIN_CIRCUIT_BREAKER,
  ZITADEL_ADMIN_CONFIG,
} from './zitadel-admin.constants';
import { ZitadelAdminService } from './zitadel-admin.service';
import { CircuitBreaker } from '../core-client/circuit-breaker';

// Mismos parametros que CoreClientModule/CipClientModule (5 fallos consecutivos, 30s de reset).
@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: ZITADEL_ADMIN_CONFIG,
      useFactory: loadZitadelAdminConfig,
    },
    {
      provide: ZITADEL_ADMIN_CIRCUIT_BREAKER,
      useFactory: () =>
        new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 }),
    },
    ZitadelAdminService,
  ],
  exports: [ZitadelAdminService],
})
export class ZitadelAdminModule {}
