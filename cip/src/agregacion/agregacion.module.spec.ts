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
import { AgregacionModule } from './agregacion.module';
import { AgregacionRepository } from './agregacion.repository';
import { AgregacionService } from './agregacion.service';
import { EventosOutboxWorker } from './eventos-outbox.worker';
import { SyncEstadoWatcher } from './sync-estado.watcher';
import { CIP_EVENTOS_QUEUE } from './eventos-outbox-queue.constants';
import { DatabaseModule } from '../database/database.module';

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
      REDIS_URL: 'redis://localhost:6379',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires AgregacionRepository, AgregacionService, el worker y el watcher, y cierra la cola al destruirse', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, AgregacionModule],
    }).compile();

    expect(module.get(AgregacionRepository)).toBeInstanceOf(
      AgregacionRepository,
    );
    expect(module.get(AgregacionService)).toBeInstanceOf(AgregacionService);
    expect(module.get(EventosOutboxWorker)).toBeInstanceOf(EventosOutboxWorker);
    expect(module.get(SyncEstadoWatcher)).toBeInstanceOf(SyncEstadoWatcher);
    expect(module.get(CIP_EVENTOS_QUEUE)).toBeDefined();

    await module.close();
  });
});
