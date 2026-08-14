import { Test, TestingModule } from '@nestjs/testing';
import { EventosModule } from './eventos.module';
import { EventoRepository } from './evento.repository';
import { DatabaseModule } from '../database/database.module';

describe('EventosModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
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

  it('wires EventoRepository', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, EventosModule],
    }).compile();

    expect(module.get(EventoRepository)).toBeInstanceOf(EventoRepository);

    await module.close();
  });
});
