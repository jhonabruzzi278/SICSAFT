import { Test, TestingModule } from '@nestjs/testing';
import { QrConnectorModule } from './qr-connector.module';
import { QrConnectorController } from './qr-connector.controller';
import { ZitadelAuthModule } from '../common/auth/zitadel-auth.module';

describe('QrConnectorModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ZITADEL_ISSUER: 'http://id.sicsaft.localhost',
      ZITADEL_AUDIENCE: 'cis-api',
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires QrConnectorController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ZitadelAuthModule, QrConnectorModule],
    }).compile();

    expect(module.get(QrConnectorController)).toBeInstanceOf(
      QrConnectorController,
    );
  });
});
