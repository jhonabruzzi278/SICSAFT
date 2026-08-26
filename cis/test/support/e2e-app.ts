import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import type { JWTVerifyGetKey } from 'jose';
import { AppModule } from '../../src/app.module';
import { KEYCLOAK_JWKS } from '../../src/common/auth/keycloak-auth.constants';
import { CoreClientService } from '../../src/core-client/core-client.service';
import { CipClientService } from '../../src/cip-client/cip-client.service';
import { KeycloakAdminService } from '../../src/keycloak-admin/keycloak-admin.service';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';
import type { RedisStub } from './redis-stub';

interface OpcionesAppE2e {
  jwks: JWTVerifyGetKey;
  coreClientService: unknown;
  redisClient: RedisStub;
  // DOC-019 3.1 — opcional: solo dashboard-connector.e2e-spec.ts lo necesita, el resto de los
  // specs no le habla a CIP. Sin stub, CipClientModule sigue armando el HttpService real (nunca
  // se invoca si el spec no pega a /dashboard/...).
  cipClientService?: unknown;
  // ADR-004 — reemplaza a zitadelAdminService, mismo criterio: solo lo necesitan los specs cuyo
  // token trae un claim `organization` no vacío (KeycloakAuthGuard resuelve rolesPorOrganizacion
  // llamando a KeycloakAdminService) o que gestionan usuarios directo (alta/asignación de rol).
  // Sin stub, KeycloakAdminModule sigue armando el HttpService real hacia Keycloak (nunca se
  // invoca si el spec no ejercita ninguno de esos casos).
  keycloakAdminService?: unknown;
}

// Bootstrap compartido por los e2e de CIS: reemplaza el JWKS remoto (createRemoteJWKSet contra
// Keycloak real), CoreClientService (HTTP real hacia CORE) y el cliente de Redis por stubs — cada
// spec prueba su controller + guard + servicio de punta a punta vía HTTP real, sin depender de
// que Keycloak/CORE/Redis esten corriendo. Antes duplicado en cada archivo (SonarCloud lo marcaba
// como duplicacion real).
export async function crearAppE2e(
  opciones: OpcionesAppE2e,
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(KEYCLOAK_JWKS)
    .useValue(opciones.jwks)
    .overrideProvider(CoreClientService)
    .useValue(opciones.coreClientService)
    .overrideProvider(REDIS_CLIENT)
    .useValue(opciones.redisClient);
  if (opciones.cipClientService) {
    builder = builder
      .overrideProvider(CipClientService)
      .useValue(opciones.cipClientService);
  }
  if (opciones.keycloakAdminService) {
    builder = builder
      .overrideProvider(KeycloakAdminService)
      .useValue(opciones.keycloakAdminService);
  }
  const moduleFixture: TestingModule = await builder.compile();

  const app: INestApplication<App> = moduleFixture.createNestApplication();
  await app.init();
  return app;
}
