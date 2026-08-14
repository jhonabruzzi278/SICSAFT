import { Test, TestingModule } from '@nestjs/testing';
import { OrquestadorModule } from './orquestador.module';
import { InventariosController } from '../inventarios/inventarios.controller';
import { ActivoEscrituraController } from '../patrimonial/activo-escritura.controller';
import { ServiceTokenModule } from '../common/auth/service-token.module';
import { DatabaseModule } from '../database/database.module';

describe('OrquestadorModule', () => {
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

  it('wires InventariosController con el Orquestador detras', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule, DatabaseModule, OrquestadorModule],
    }).compile();

    expect(module.get(InventariosController)).toBeInstanceOf(
      InventariosController,
    );
    expect(module.get(ActivoEscrituraController)).toBeInstanceOf(
      ActivoEscrituraController,
    );

    await module.close();
  });
});
