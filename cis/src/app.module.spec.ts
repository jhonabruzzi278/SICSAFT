import type { MiddlewareConsumer } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { CorrelationIdMiddleware } from './common/correlation-id/correlation-id.middleware';

describe('AppModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ZITADEL_ISSUER: 'http://id.sicsaft.localhost',
      ZITADEL_AUDIENCE: 'cis-api',
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido',
      REDIS_URL: 'redis://localhost:6379',
      ZITADEL_ORG_ID_MAP: '{"386029528616558597":"duoc-uc"}',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires AppController with its dependencies', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(AppController)).toBeInstanceOf(AppController);
  });

  it('aplica CorrelationIdMiddleware a todas las rutas', () => {
    const forRoutes = jest.fn();
    const apply = jest.fn().mockReturnValue({ forRoutes });
    const consumer = { apply } as unknown as MiddlewareConsumer;

    new AppModule().configure(consumer);

    expect(apply).toHaveBeenCalledWith(CorrelationIdMiddleware);
    expect(forRoutes).toHaveBeenCalledWith('*');
  });
});
