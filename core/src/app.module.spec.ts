import type { MiddlewareConsumer } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';
import { CorrelationIdMiddleware } from './common/correlation-id/correlation-id.middleware';
import { createPgBossClient } from './eventos-outbox/create-pgboss-client';

// Se mockea el wrapper de pg-boss (no `DatabaseModule`, que sigue lazy vía `pg.Pool`) — sin esto,
// compilar AppModule de verdad intentaría conectar/migrar contra el `EVENTOS_OUTBOX_DATABASE_URL`
// de abajo, que no apunta a ningún Postgres real. Mismo criterio que
// `eventos-outbox/eventos-outbox.module.spec.ts`.
jest.mock('./eventos-outbox/create-pgboss-client');

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
      EVENTOS_OUTBOX_DATABASE_URL:
        'postgres://eventos:secreto@postgres/eventos_outbox',
    };
    jest.mocked(createPgBossClient).mockResolvedValue({
      start: jest.fn().mockResolvedValue(undefined),
      createQueue: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
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
