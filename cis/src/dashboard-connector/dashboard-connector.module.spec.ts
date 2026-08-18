import { Test, TestingModule } from '@nestjs/testing';
import { DashboardConnectorModule } from './dashboard-connector.module';
import { DashboardConnectorController } from './dashboard-connector.controller';
import { ZitadelAuthModule } from '../common/auth/zitadel-auth.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';

describe('DashboardConnectorModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ZITADEL_ISSUER: 'http://id.sicsaft.localhost',
      ZITADEL_AUDIENCE: 'cis-api',
      CIP_URL: 'http://cip:3002',
      CIP_SERVICE_TOKEN: 'secreto-compartido',
      REDIS_URL: 'redis://localhost:6379',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires DashboardConnectorController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ZitadelAuthModule, RateLimitModule, DashboardConnectorModule],
    }).compile();

    expect(module.get(DashboardConnectorController)).toBeInstanceOf(
      DashboardConnectorController,
    );
  });
});
