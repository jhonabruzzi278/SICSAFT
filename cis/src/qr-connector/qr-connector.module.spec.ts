import { Test, TestingModule } from '@nestjs/testing';
import { QrConnectorModule } from './qr-connector.module';
import { QrConnectorController } from './qr-connector.controller';
import { KeycloakAuthModule } from '../common/auth/keycloak-auth.module';
import { KeycloakAdminModule } from '../keycloak-admin/keycloak-admin.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

describe('QrConnectorModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      KEYCLOAK_URL: 'http://keycloak:8080',
      KEYCLOAK_REALM: 'sicsaft',
      KEYCLOAK_AUDIENCE: 'cis-api',
      KEYCLOAK_ADMIN_CLIENT_ID: 'cis-admin',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'secreto-compartido',
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires QrConnectorController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        KeycloakAuthModule,
        KeycloakAdminModule,
        RateLimitModule,
        QrConnectorModule,
      ],
    }).compile();

    expect(module.get(QrConnectorController)).toBeInstanceOf(
      QrConnectorController,
    );
  });
});
