import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  SignJWT,
  generateKeyPair,
  type JWTVerifyGetKey,
  type KeyLike,
} from 'jose';
import { ZitadelAuthGuard } from './zitadel-auth.guard';
import type { ZitadelAuthConfig } from './zitadel-auth.config';

const ISSUER = 'http://id.sicsaft.localhost';
const AUDIENCE = 'cis-api';
const CONFIG: ZitadelAuthConfig = {
  issuer: ISSUER,
  audience: AUDIENCE,
  jwksUri: `${ISSUER}/oauth/v2/keys`,
};

function buildContext(authorization: string | undefined): ExecutionContext {
  const request = { headers: { authorization } };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ZitadelAuthGuard', () => {
  let publicKey: KeyLike;
  let privateKey: KeyLike;
  let jwks: JWTVerifyGetKey;
  let guard: ZitadelAuthGuard;

  beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256');
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
    // El guard solo necesita un JWTVerifyGetKey — en produccion es createRemoteJWKSet(jwksUri)
    // (ver zitadel-auth.module.ts); en el test se inyecta la llave publica local directamente
    // para no depender de red.
    jwks = () => Promise.resolve(publicKey);
  });

  beforeEach(() => {
    guard = new ZitadelAuthGuard(CONFIG, jwks);
  });

  async function signToken(
    overrides: {
      subject?: string;
      issuer?: string;
      audience?: string;
      expiresIn?: string;
      omitExpiration?: boolean;
      omitSubject?: boolean;
    } = {},
  ): Promise<string> {
    let builder = new SignJWT({}).setProtectedHeader({ alg: 'RS256' });
    if (!overrides.omitSubject) {
      builder = builder.setSubject(overrides.subject ?? 'op-1');
    }
    builder = builder
      .setIssuer(overrides.issuer ?? ISSUER)
      .setAudience(overrides.audience ?? AUDIENCE);
    if (!overrides.omitExpiration) {
      builder = builder.setExpirationTime(overrides.expiresIn ?? '15m');
    }
    return builder.sign(privateKey);
  }

  it('setea request.auth con operadorId/accessToken/expiresAt cuando el token es valido', async () => {
    const token = await signToken({ subject: 'op-1' });
    const context = buildContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    const request = context.switchToHttp().getRequest<{
      auth?: { operadorId: string; accessToken: string; expiresAt: string };
    }>();
    expect(request.auth?.operadorId).toBe('op-1');
    expect(request.auth?.accessToken).toBe(token);
    expect(Number.isNaN(Date.parse(request.auth?.expiresAt ?? ''))).toBe(false);
  });

  it('lanza 401 si falta el header Authorization', async () => {
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el header no empieza con "Bearer "', async () => {
    await expect(guard.canActivate(buildContext('Basic abc'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el header es "Bearer " sin token', async () => {
    await expect(guard.canActivate(buildContext('Bearer '))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el token esta firmado con otra llave', async () => {
    const otherKeyPair = await generateKeyPair('RS256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('op-1')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('15m')
      .sign(otherKeyPair.privateKey);

    await expect(
      guard.canActivate(buildContext(`Bearer ${token}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lanza 401 si el token esta vencido', async () => {
    const token = await signToken({ expiresIn: '-1s' });
    await expect(
      guard.canActivate(buildContext(`Bearer ${token}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lanza 401 si el issuer no coincide', async () => {
    const token = await signToken({ issuer: 'http://otro-issuer' });
    await expect(
      guard.canActivate(buildContext(`Bearer ${token}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lanza 401 si el audience no coincide', async () => {
    const token = await signToken({ audience: 'otra-api' });
    await expect(
      guard.canActivate(buildContext(`Bearer ${token}`)),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lanza 401 si el token no trae `sub`', async () => {
    const token = await signToken({ omitSubject: true });
    await expect(
      guard.canActivate(buildContext(`Bearer ${token}`)),
    ).rejects.toThrow('no trae `sub`');
  });

  it('lanza 401 si el token no trae `exp`', async () => {
    const token = await signToken({ omitExpiration: true });
    await expect(
      guard.canActivate(buildContext(`Bearer ${token}`)),
    ).rejects.toThrow('no trae `exp`');
  });
});
