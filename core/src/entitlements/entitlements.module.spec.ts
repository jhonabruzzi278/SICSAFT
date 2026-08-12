import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsModule } from './entitlements.module';
import { EntitlementsController } from './entitlements.controller';
import { ServiceTokenModule } from '../common/auth/service-token.module';

describe('EntitlementsModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CORE_SERVICE_TOKEN: 'secreto-compartido' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires EntitlementsController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule, EntitlementsModule],
    }).compile();

    expect(module.get(EntitlementsController)).toBeInstanceOf(
      EntitlementsController,
    );
  });
});
