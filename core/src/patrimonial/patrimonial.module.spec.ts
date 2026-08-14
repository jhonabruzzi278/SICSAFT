import { Test, TestingModule } from '@nestjs/testing';
import { PatrimonialModule } from './patrimonial.module';
import { CatalogoController } from './catalogo.controller';
import { EscrituraActivoService } from './escritura-activo.service';
import { ServiceTokenModule } from '../common/auth/service-token.module';
import { DatabaseModule } from '../database/database.module';

describe('PatrimonialModule', () => {
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

  it('wires CatalogoController', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule, DatabaseModule, PatrimonialModule],
    }).compile();

    expect(module.get(CatalogoController)).toBeInstanceOf(CatalogoController);
    expect(module.get(EscrituraActivoService)).toBeInstanceOf(
      EscrituraActivoService,
    );

    await module.close();
  });
});
