import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaModule } from './auditoria.module';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaEscrituraController } from './auditoria-escritura.controller';
import { AuditoriaRepository } from './auditoria.repository';
import { DatabaseModule } from '../database/database.module';
import { ServiceTokenModule } from '../common/auth/service-token.module';

describe('AuditoriaModule', () => {
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

  it('wires AuditoriaRepository', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule, DatabaseModule, AuditoriaModule],
    }).compile();

    expect(module.get(AuditoriaRepository)).toBeInstanceOf(AuditoriaRepository);
    expect(module.get(AuditoriaController)).toBeInstanceOf(AuditoriaController);
    expect(module.get(AuditoriaEscrituraController)).toBeInstanceOf(
      AuditoriaEscrituraController,
    );

    await module.close();
  });
});
