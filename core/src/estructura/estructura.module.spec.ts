import { Test, TestingModule } from '@nestjs/testing';
import { EstructuraModule } from './estructura.module';
import { AreaController } from './area.controller';
import { EscrituraEstructuraService } from './escritura-estructura.service';
import { ServiceTokenModule } from '../common/auth/service-token.module';
import { DatabaseModule } from '../database/database.module';

describe('EstructuraModule', () => {
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

  it('wires AreaController y EscrituraEstructuraService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule, DatabaseModule, EstructuraModule],
    }).compile();

    expect(module.get(AreaController)).toBeInstanceOf(AreaController);
    expect(module.get(EscrituraEstructuraService)).toBeInstanceOf(
      EscrituraEstructuraService,
    );

    await module.close();
  });
});
