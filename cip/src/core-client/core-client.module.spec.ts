import { Test, TestingModule } from '@nestjs/testing';
import { CoreClientModule } from './core-client.module';
import { CoreClientService } from './core-client.service';

describe('CoreClientModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires CoreClientService con la config leída de env', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CoreClientModule],
    }).compile();

    expect(module.get(CoreClientService)).toBeInstanceOf(CoreClientService);
  });
});
