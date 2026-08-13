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

  it('wires AppController with its dependencies', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(AppController)).toBeInstanceOf(AppController);

    await module.close();
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
