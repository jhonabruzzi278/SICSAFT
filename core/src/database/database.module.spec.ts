import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { DatabaseModule } from './database.module';
import { PG_POOL } from './database.constants';

describe('DatabaseModule', () => {
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

  it('provee un Pool de pg configurado desde el env', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    expect(module.get(PG_POOL)).toBeInstanceOf(Pool);

    await module.close();
  });
});
