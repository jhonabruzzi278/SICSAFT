jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Queue: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined),
    getWaitingCount: jest.fn().mockResolvedValue(0),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { HealthController } from './health/health.controller';
import { DashboardController } from './dashboard/dashboard.controller';

describe('AppModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CIP_DB_HOST: 'postgres',
      CIP_DB_PORT: '5432',
      CIP_DB_NAME: 'cip',
      CIP_DB_USER: 'cip',
      CIP_DB_PASSWORD: 'secreto',
      CIP_SERVICE_TOKEN: 'secreto-compartido-cip',
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido-core',
      REDIS_URL: 'redis://:secreto@localhost:6379',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires HealthController y DashboardController con sus dependencias', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(HealthController)).toBeInstanceOf(HealthController);
    expect(module.get(DashboardController)).toBeInstanceOf(DashboardController);

    await module.close();
  });
});
