import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../database/database.module';
import { createPgBossClient } from './create-pgboss-client';
import { CIP_EVENTOS_PGBOSS } from './eventos-outbox.constants';
import { EventosOutboxDispatcher } from './eventos-outbox.dispatcher';
import { EventosOutboxModule } from './eventos-outbox.module';
import { EventosOutboxRepository } from './eventos-outbox.repository';

// Se mockea el wrapper propio (`createPgBossClient`), no el paquete `pg-boss` — así el import
// dinámico real (ESM-only, ver `create-pgboss-client.ts`) nunca llega a ejecutarse en este test de
// wiring de DI, que solo verifica que el módulo arma/desarma sus providers, no que pg-boss se
// conecte de verdad (eso lo cubre test/jest-e2e.json contra Postgres real).
jest.mock('./create-pgboss-client');

const bossMock = {
  start: jest.fn().mockResolvedValue(undefined),
  createQueue: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

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
      EVENTOS_OUTBOX_DATABASE_URL:
        'postgres://eventos:secreto@postgres/eventos_outbox',
    };
    jest.mocked(createPgBossClient).mockResolvedValue(bossMock as never);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('wires EventosOutboxRepository, el cliente de pg-boss y el dispatcher, y lo detiene al destruirse', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, EventosOutboxModule],
    }).compile();

    expect(module.get(EventosOutboxRepository)).toBeInstanceOf(
      EventosOutboxRepository,
    );
    expect(module.get(EventosOutboxDispatcher)).toBeInstanceOf(
      EventosOutboxDispatcher,
    );
    expect(module.get(CIP_EVENTOS_PGBOSS)).toBe(bossMock);
    expect(bossMock.start).toHaveBeenCalled();
    expect(bossMock.createQueue).toHaveBeenCalledWith('cip-eventos');

    await module.close();

    expect(bossMock.stop).toHaveBeenCalled();
  });
});
