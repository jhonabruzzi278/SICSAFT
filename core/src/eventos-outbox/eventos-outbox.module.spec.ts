import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../database/database.module';
import {
  CIP_EVENTOS_QUEUE,
  CIP_EVENTOS_REDIS_CONNECTION,
} from './eventos-outbox.constants';
import { EventosOutboxDispatcher } from './eventos-outbox.dispatcher';
import { EventosOutboxModule } from './eventos-outbox.module';
import { EventosOutboxRepository } from './eventos-outbox.repository';

describe('EventosOutboxModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CORE_DB_HOST: 'postgres',
      CORE_DB_PORT: '5432',
      CORE_DB_NAME: 'core',
      CORE_DB_USER: 'core',
      CORE_DB_PASSWORD: 'secreto',
      REDIS_URL: 'redis://:secreto@localhost:6379',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires EventosOutboxRepository, la cola y el dispatcher, y cierra la cola al destruirse', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, EventosOutboxModule],
    }).compile();

    expect(module.get(EventosOutboxRepository)).toBeInstanceOf(
      EventosOutboxRepository,
    );
    expect(module.get(EventosOutboxDispatcher)).toBeInstanceOf(
      EventosOutboxDispatcher,
    );
    expect(module.get(CIP_EVENTOS_QUEUE)).toBeDefined();
    expect(module.get(CIP_EVENTOS_REDIS_CONNECTION)).toBeDefined();

    await module.close();
  });
});
