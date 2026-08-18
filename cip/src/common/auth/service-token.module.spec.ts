import { Test, TestingModule } from '@nestjs/testing';
import { ServiceTokenModule } from './service-token.module';
import { ServiceTokenGuard } from './service-token.guard';
import { SERVICE_TOKEN_CONFIG } from './service-token.constants';

describe('ServiceTokenModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CIP_SERVICE_TOKEN: 'secreto-compartido' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires ServiceTokenGuard con la config leida de env', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ServiceTokenModule],
    }).compile();

    expect(module.get(ServiceTokenGuard)).toBeInstanceOf(ServiceTokenGuard);
    expect(module.get(SERVICE_TOKEN_CONFIG)).toEqual({
      token: 'secreto-compartido',
    });
  });
});
