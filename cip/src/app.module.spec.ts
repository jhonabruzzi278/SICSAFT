import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { HealthController } from './health/health.controller';
import { DashboardController } from './dashboard/dashboard.controller';
import { createPgBossClient } from './agregacion/create-pgboss-client';

// Se mockea el wrapper de pg-boss (no `DatabaseModule`, que sigue lazy vía `pg.Pool`) — sin esto,
// compilar AppModule de verdad intentaría conectar/migrar contra el `EVENTOS_OUTBOX_DATABASE_URL`
// de abajo, que no apunta a ningún Postgres real. Mismo criterio que
// agregacion/agregacion.module.spec.ts.
jest.mock('./agregacion/create-pgboss-client');

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
      EVENTOS_OUTBOX_DATABASE_URL:
        'postgres://eventos:secreto@postgres/eventos_outbox',
    };
    jest.mocked(createPgBossClient).mockResolvedValue({
      start: jest.fn().mockResolvedValue(undefined),
      createQueue: jest.fn().mockResolvedValue(undefined),
      work: jest.fn().mockResolvedValue('worker-id'),
      offWork: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    } as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
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
