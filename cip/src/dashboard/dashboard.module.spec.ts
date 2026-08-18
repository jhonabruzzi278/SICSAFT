import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../database/database.module';
import { ServiceTokenModule } from '../common/auth/service-token.module';
import { DashboardModule } from './dashboard.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';

describe('DashboardModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CIP_DB_HOST: 'postgres',
      CIP_DB_PORT: '5432',
      CIP_DB_NAME: 'cip',
      CIP_DB_USER: 'cip',
      CIP_DB_PASSWORD: 'secreto',
      CIP_SERVICE_TOKEN: 'secreto-compartido',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires DashboardController y DashboardRepository', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, ServiceTokenModule, DashboardModule],
    }).compile();

    expect(module.get(DashboardController)).toBeInstanceOf(DashboardController);
    expect(module.get(DashboardRepository)).toBeInstanceOf(DashboardRepository);

    await module.close();
  });
});
