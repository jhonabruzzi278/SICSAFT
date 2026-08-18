import { Test, TestingModule } from '@nestjs/testing';
import { CipClientModule } from './cip-client.module';
import { CipClientService } from './cip-client.service';

describe('CipClientModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CIP_URL: 'http://cip:3002',
      CIP_SERVICE_TOKEN: 'secreto-compartido',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires CipClientService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CipClientModule],
    }).compile();

    expect(module.get(CipClientService)).toBeInstanceOf(CipClientService);
  });
});
