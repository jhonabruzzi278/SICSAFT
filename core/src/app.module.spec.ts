import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { AppController } from './app.controller';

describe('AppModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CORE_SERVICE_TOKEN: 'secreto-compartido' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires AppController with its dependencies', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(AppController)).toBeInstanceOf(AppController);
  });
});
