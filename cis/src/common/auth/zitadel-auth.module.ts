import { Global, Module } from '@nestjs/common';
import { createRemoteJWKSet } from 'jose';
import { loadZitadelAuthConfig } from './zitadel-auth.config';
import { ZITADEL_AUTH_CONFIG, ZITADEL_JWKS } from './zitadel-auth.constants';
import { ZitadelAuthGuard } from './zitadel-auth.guard';

// Global: el guard de auth se usa en cualquier controller que exponga el conector (hoy solo
// QrConnectorController, pero cualquier modulo nuevo lo necesita sin tener que reimportar esto).
@Global()
@Module({
  providers: [
    {
      provide: ZITADEL_AUTH_CONFIG,
      useFactory: loadZitadelAuthConfig,
    },
    {
      provide: ZITADEL_JWKS,
      // createRemoteJWKSet cachea las llaves y respeta sus Cache-Control — no se refetchea en
      // cada request. Ver zitadel-auth.config.ts para por que jwksUri no siempre es == issuer.
      useFactory: (config: ReturnType<typeof loadZitadelAuthConfig>) =>
        createRemoteJWKSet(new URL(config.jwksUri)),
      inject: [ZITADEL_AUTH_CONFIG],
    },
    ZitadelAuthGuard,
  ],
  exports: [ZITADEL_AUTH_CONFIG, ZITADEL_JWKS, ZitadelAuthGuard],
})
export class ZitadelAuthModule {}
