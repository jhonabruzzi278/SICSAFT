import { Test, TestingModule } from '@nestjs/testing';
import { AgregacionModule } from './agregacion.module';
import { AgregacionRepository } from './agregacion.repository';
import { AgregacionService } from './agregacion.service';
import { createPgBossClient } from './create-pgboss-client';
import { CIP_EVENTOS_PGBOSS } from './eventos-outbox-queue.constants';
import { EventosOutboxWorker } from './eventos-outbox.worker';
import { SyncEstadoWatcher } from './sync-estado.watcher';
import { DatabaseModule } from '../database/database.module';

// Se mockea el wrapper propio (`createPgBossClient`), no el paquete `pg-boss` — así el import
// dinámico real (ESM-only) nunca llega a ejecutarse en este test de wiring de DI. Mismo criterio
// que core/src/eventos-outbox/eventos-outbox.module.spec.ts.
jest.mock('./create-pgboss-client');

const bossMock = {
  start: jest.fn().mockResolvedValue(undefined),
  createQueue: jest.fn().mockResolvedValue(undefined),
  work: jest.fn().mockResolvedValue('worker-id'),
  offWork: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

describe('AgregacionModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CIP_DB_HOST: 'postgres',
      CIP_DB_PORT: '5432',
      CIP_DB_NAME: 'cip',
      CIP_DB_USER: 'cip',
      CIP_DB_PASSWORD: 'secreto',
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido',
      EVENTOS_OUTBOX_DATABASE_URL:
        'postgres://eventos:secreto@postgres/eventos_outbox',
    };
    jest.mocked(createPgBossClient).mockResolvedValue(bossMock as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('wires AgregacionRepository, AgregacionService, el worker y el watcher, y detiene pg-boss al destruirse', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, AgregacionModule],
    }).compile();

    expect(module.get(AgregacionRepository)).toBeInstanceOf(
      AgregacionRepository,
    );
    expect(module.get(AgregacionService)).toBeInstanceOf(AgregacionService);
    expect(module.get(EventosOutboxWorker)).toBeInstanceOf(EventosOutboxWorker);
    expect(module.get(SyncEstadoWatcher)).toBeInstanceOf(SyncEstadoWatcher);
    expect(module.get(CIP_EVENTOS_PGBOSS)).toBe(bossMock);
    expect(bossMock.createQueue).toHaveBeenCalledWith('cip-eventos');

    await module.init();
    expect(bossMock.work).toHaveBeenCalledWith(
      'cip-eventos',
      expect.any(Function),
    );

    await module.close();

    expect(bossMock.stop).toHaveBeenCalled();
  });
});
