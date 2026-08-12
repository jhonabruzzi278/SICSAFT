import { Test, TestingModule } from '@nestjs/testing';
import { ZitadelAuthModule } from './zitadel-auth.module';
import { ZitadelAuthGuard } from './zitadel-auth.guard';
import { ZITADEL_AUTH_CONFIG } from './zitadel-auth.constants';

describe('ZitadelAuthModule', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ZITADEL_ISSUER: 'http://id.sicsaft.localhost',
      ZITADEL_AUDIENCE: 'cis-api',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('wires ZitadelAuthGuard con la config leida de env', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ZitadelAuthModule],
    }).compile();

    expect(module.get(ZitadelAuthGuard)).toBeInstanceOf(ZitadelAuthGuard);
    expect(module.get(ZITADEL_AUTH_CONFIG)).toEqual({
      issuer: 'http://id.sicsaft.localhost',
      audience: 'cis-api',
      jwksUri: 'http://id.sicsaft.localhost/oauth/v2/keys',
    });
  });
});
