import { Global, Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { loadKeycloakAuthConfig } from './keycloak-auth.config';
import { KEYCLOAK_AUTH_CONFIG, KEYCLOAK_JWKS } from './keycloak-auth.constants';
import { KeycloakAuthGuard } from './keycloak-auth.guard';
import { KeycloakAdminModule } from '../../keycloak-admin/keycloak-admin.module';

// ADR-004 — reemplaza a ZitadelAuthModule. Importa KeycloakAdminModule (acoplamiento nuevo que
// ZitadelAuthModule no tenía): KeycloakAuthGuard necesita resolver rolesPorOrganizacion contra la
// Admin API de Keycloak, ya que el JWT ya no los trae anidados por organización (ver el comentario
// de keycloak-auth.guard.ts).
@Global()
@Module({
  imports: [KeycloakAdminModule],
  providers: [
    { provide: KEYCLOAK_AUTH_CONFIG, useFactory: loadKeycloakAuthConfig },
    {
      provide: KEYCLOAK_JWKS,
      useFactory: (config: ReturnType<typeof loadKeycloakAuthConfig>) =>
        createRemoteJWKSet(new URL(config.jwksUri)),
      inject: [KEYCLOAK_AUTH_CONFIG],
    },
    KeycloakAuthGuard,
  ],
  exports: [KEYCLOAK_AUTH_CONFIG, KEYCLOAK_JWKS, KeycloakAuthGuard],
})
export class KeycloakAuthModule {}
