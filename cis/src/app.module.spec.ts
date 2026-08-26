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
      KEYCLOAK_URL: 'http://keycloak:8080',
      KEYCLOAK_REALM: 'sicsaft',
      KEYCLOAK_AUDIENCE: 'cis-api',
      KEYCLOAK_ADMIN_CLIENT_ID: 'cis-admin',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'secreto-compartido',
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido',
      CIP_URL: 'http://cip:3002',
      CIP_SERVICE_TOKEN: 'secreto-compartido-cip',
      REDIS_URL: 'redis://localhost:6379',
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
