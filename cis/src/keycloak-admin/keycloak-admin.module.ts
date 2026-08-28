import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { loadKeycloakAdminConfig } from './keycloak-admin.config';
import {
  KEYCLOAK_ADMIN_CIRCUIT_BREAKER,
  KEYCLOAK_ADMIN_CONFIG,
} from './keycloak-admin.constants';
import { KeycloakAdminService } from './keycloak-admin.service';
import { CircuitBreaker } from '../core-client/circuit-breaker';

// Mismos parámetros que CoreClientModule/CipClientModule (5 fallos consecutivos, 30s de reset) —
// reemplaza a ZitadelAdminModule (ADR-004). @Global() (a diferencia de ZitadelAdminModule, que no
// lo era): KeycloakAuthGuard -- ya @Global() vía KeycloakAuthModule -- depende de
// KeycloakAdminService para resolver rolesPorOrganizacion, y un guard expuesto por @UseGuards()
// necesita que sus propias dependencias sean resolubles globalmente (mismo criterio ya usado por
// RateLimitModule, también @Global()).
@Global()
@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: KEYCLOAK_ADMIN_CONFIG,
      useFactory: loadKeycloakAdminConfig,
    },
    {
      provide: KEYCLOAK_ADMIN_CIRCUIT_BREAKER,
      useFactory: () =>
        new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 }),
    },
    KeycloakAdminService,
  ],
  exports: [KeycloakAdminService],
})
export class KeycloakAdminModule {}
