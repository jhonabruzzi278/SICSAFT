import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementsModule } from './entitlements.module';
import { EntitlementsController } from './entitlements.controller';
import { ServiceTokenModule } from '../common/auth/service-token.module';
import { DatabaseModule } from '../database/database.module';

describe('EntitlementsModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CORE_SERVICE_TOKEN: 'secreto-compartido',
      CORE_DB_HOST: 'postgres',
      CORE_DB_PORT: '5432',
      CORE_DB_NAME: 'core',
      CORE_DB_USER: 'core',
      CORE_DB_PASSWORD: 'secreto',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires EntitlementsController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule, DatabaseModule, EntitlementsModule],
    }).compile();

    expect(module.get(EntitlementsController)).toBeInstanceOf(
      EntitlementsController,
    );

    await module.close();
  });
});
