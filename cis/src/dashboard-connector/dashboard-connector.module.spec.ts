import { Test, TestingModule } from '@nestjs/testing';
import { DashboardConnectorModule } from './dashboard-connector.module';
import { DashboardConnectorController } from './dashboard-connector.controller';
import { KeycloakAuthModule } from '../common/auth/keycloak-auth.module';
import { KeycloakAdminModule } from '../keycloak-admin/keycloak-admin.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

describe('DashboardConnectorModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KEYCLOAK_URL: 'http://keycloak:8080',
      KEYCLOAK_REALM: 'sicsaft',
      KEYCLOAK_AUDIENCE: 'cis-api',
      KEYCLOAK_ADMIN_CLIENT_ID: 'cis-admin',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'secreto-compartido',
      CIP_URL: 'http://cip:3002',
      CIP_SERVICE_TOKEN: 'secreto-compartido',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires DashboardConnectorController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        KeycloakAuthModule,
        KeycloakAdminModule,
        RateLimitModule,
        DashboardConnectorModule,
      ],
    }).compile();

    expect(module.get(DashboardConnectorController)).toBeInstanceOf(
      DashboardConnectorController,
    );
  });
});
