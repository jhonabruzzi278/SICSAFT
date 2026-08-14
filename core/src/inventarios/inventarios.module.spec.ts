import { Test, TestingModule } from '@nestjs/testing';
import { InventariosModule } from './inventarios.module';
import { InventariosService } from './inventarios.service';
import { ServiceTokenModule } from '../common/auth/service-token.module';
import { DatabaseModule } from '../database/database.module';

describe('InventariosModule', () => {
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

  it('wires InventariosService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule, DatabaseModule, InventariosModule],
    }).compile();

    expect(module.get(InventariosService)).toBeInstanceOf(InventariosService);

    await module.close();
  });
});
